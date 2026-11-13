import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { checkBudgetAlerts } from '../lib/alerts.js';

const router = Router();
router.use(requireAuth);

const budgetSchema = z.object({
  category_id: z.string().uuid(),
  monthly_limit: z.number().positive().max(1000000),
  alert_threshold: z.number().int().min(1).max(100).default(80)
});

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*, categories(name, icon, color)')
      .eq('user_id', req.userId);
    if (error) throw error;

    // Gasto del mes por categoría
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('user_id', req.userId)
      .gte('expense_date', monthStart);

    const spent = {};
    for (const e of expenses || []) {
      if (e.category_id) spent[e.category_id] = (spent[e.category_id] || 0) + Number(e.amount);
    }

    const result = budgets.map((b) => ({
      ...b,
      spent: spent[b.category_id] || 0,
      percent: Math.min(100, Math.round(((spent[b.category_id] || 0) / b.monthly_limit) * 100))
    }));

    res.json({ budgets: result });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const input = budgetSchema.parse(req.body);
    const { data, error } = await supabase
      .from('budgets')
      .upsert({ ...input, user_id: req.userId }, { onConflict: 'user_id,category_id' })
      .select('*, categories(name, icon, color)')
      .single();
    if (error) throw error;
    res.status(201).json({ budget: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Evaluación manual de alertas de presupuesto (también se dispara al crear gasto)
router.post('/check-alerts', async (req, res, next) => {
  try {
    const created = await checkBudgetAlerts(req.userId);
    res.json({ alertsCreated: created });
  } catch (err) { next(err); }
});

export default router;
