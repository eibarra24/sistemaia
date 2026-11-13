import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Tipos de alerta soportados:
// - budget_threshold: presupuesto de categoría supera X%
// - large_expense: gasto individual supera un monto
// - monthly_total: gasto total del mes supera un monto
const alertSchema = z.object({
  type: z.enum(['budget_threshold', 'large_expense', 'monthly_total']),
  threshold: z.number().positive().max(1000000),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true)
});

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*, categories(name, icon, color)')
      .eq('user_id', req.userId)
      .order('created_at');
    if (error) throw error;
    res.json({ alerts: data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const input = alertSchema.parse(req.body);
    const { data, error } = await supabase
      .from('alert_rules')
      .insert({ ...input, user_id: req.userId })
      .select('*, categories(name, icon, color)')
      .single();
    if (error) throw error;
    res.status(201).json({ alert: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const input = alertSchema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('alert_rules')
      .update(input)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ alert: data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Notificaciones generadas
router.get('/notifications', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ notifications: data });
  } catch (err) { next(err); }
});

router.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.userId)
      .eq('is_read', false);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
