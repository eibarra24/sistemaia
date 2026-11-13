import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const txSchema = z.object({
  amount: z.number().positive().max(10000000),
  note: z.string().max(200).optional()
});

// Meses completos transcurridos desde `from` hasta hoy
function wholeMonths(from, to = new Date()) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, Math.min(months, 1200));
}

function advanceMonths(date, months) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth() + months, date.getDate()));
  return d.toISOString().slice(0, 10);
}

// Interés acumulado (no cobrado) con capitalización mensual
function accruedInterest(balance, annualRate, lastAccrual) {
  const months = wholeMonths(new Date(lastAccrual + 'T00:00:00'));
  if (months === 0 || balance <= 0) return { interest: 0, months };
  const monthlyRate = Number(annualRate) / 100 / 12;
  const interest = Number(balance) * (Math.pow(1 + monthlyRate, months) - 1);
  return { interest: Math.round(interest * 100) / 100, months };
}

async function getOrCreateAccount(userId) {
  const { data: existing } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

router.get('/', async (req, res, next) => {
  try {
    const account = await getOrCreateAccount(req.userId);
    const { interest } = accruedInterest(account.balance, account.annual_rate, account.last_accrual);
    const { data: transactions, error } = await supabase
      .from('savings_transactions')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({
      account: { ...account, accrued_interest: interest },
      transactions
    });
  } catch (err) { next(err); }
});

router.post('/deposit', async (req, res, next) => {
  try {
    const { amount, note } = txSchema.parse(req.body);
    const account = await getOrCreateAccount(req.userId);
    const { data: tx, error } = await supabase
      .from('savings_transactions')
      .insert({
        user_id: req.userId,
        account_id: account.id,
        type: 'deposit',
        amount,
        note: note || null
      })
      .select()
      .single();
    if (error) throw error;
    const { data: updated, error: updErr } = await supabase
      .from('savings_accounts')
      .update({ balance: Number(account.balance) + amount })
      .eq('id', account.id)
      .select()
      .single();
    if (updErr) throw updErr;
    res.status(201).json({ transaction: tx, account: updated });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

router.post('/withdraw', async (req, res, next) => {
  try {
    const { amount, note } = txSchema.parse(req.body);
    const account = await getOrCreateAccount(req.userId);
    if (Number(account.balance) < amount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }
    const { data: tx, error } = await supabase
      .from('savings_transactions')
      .insert({
        user_id: req.userId,
        account_id: account.id,
        type: 'withdrawal',
        amount,
        note: note || null
      })
      .select()
      .single();
    if (error) throw error;
    const { data: updated, error: updErr } = await supabase
      .from('savings_accounts')
      .update({ balance: Number(account.balance) - amount })
      .eq('id', account.id)
      .select()
      .single();
    if (updErr) throw updErr;
    res.status(201).json({ transaction: tx, account: updated });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// Cobra el rendimiento acumulado: lo suma al saldo y reinicia el periodo
router.post('/interest', async (req, res, next) => {
  try {
    const account = await getOrCreateAccount(req.userId);
    const { interest, months } = accruedInterest(account.balance, account.annual_rate, account.last_accrual);
    if (interest <= 0) {
      return res.status(400).json({ error: 'Aún no hay rendimiento acumulado' });
    }
    const newLastAccrual = advanceMonths(new Date(account.last_accrual + 'T00:00:00'), months);
    const newBalance = Math.round((Number(account.balance) + interest) * 100) / 100;

    const { data: tx, error } = await supabase
      .from('savings_transactions')
      .insert({
        user_id: req.userId,
        account_id: account.id,
        type: 'interest',
        amount: interest,
        note: `Rendimiento ${account.annual_rate}% anual (${months} mes${months === 1 ? '' : 'es'})`
      })
      .select()
      .single();
    if (error) throw error;

    const { data: updated, error: updErr } = await supabase
      .from('savings_accounts')
      .update({ balance: newBalance, last_accrual: newLastAccrual })
      .eq('id', account.id)
      .select()
      .single();
    if (updErr) throw updErr;

    res.status(201).json({ transaction: tx, account: updated });
  } catch (err) { next(err); }
});

export default router;
