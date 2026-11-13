import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { checkAlertsForExpense } from '../lib/alerts.js';

const router = Router();
router.use(requireAuth);

const expenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(1000000),
  category_id: z.string().uuid().nullable().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.enum(['TDC', 'EFECTIVO', 'TDEBITO', 'TRANSFERENCIA']).nullable().optional()
});

// Categorías por defecto al registrar (se crean en register via trigger o aquí)
router.get('/categories', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, icon, color')
      .eq('user_id', req.userId)
      .order('name');
    if (error) throw error;
    res.json({ categories: data });
  } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, icon, color } = z.object({
      name: z.string().min(1).max(60),
      icon: z.string().max(10).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
    }).parse(req.body);
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: req.userId, name, icon: icon || '📦', color: color || '#6366f1' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ category: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    let query = supabase
      .from('expenses')
      .select('*, categories(name, icon, color)')
      .eq('user_id', req.userId)
      .order('expense_date', { ascending: false });

    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const end = endDate.toISOString().slice(0, 10);
      query = query.gte('expense_date', start).lte('expense_date', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ expenses: data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const input = expenseSchema.parse(req.body);
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input, user_id: req.userId })
      .select('*, categories(name, icon, color)')
      .single();
    if (error) throw error;

    // Evaluar alertas en segundo plano (no bloquea la respuesta)
    checkAlertsForExpense(req.userId, data).catch((e) =>
      console.error('Error evaluando alertas:', e)
    );

    res.status(201).json({ expense: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const input = expenseSchema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('expenses')
      .update(input)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select('*, categories(name, icon, color)')
      .single();
    if (error) throw error;
    res.json({ expense: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
