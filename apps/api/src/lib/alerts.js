import { supabase } from './supabase.js';

async function notify(userId, type, title, message) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message
  });
  if (error) console.error('Error creando notificación:', error);
}

// Evalúa alertas cuando se crea un gasto.
// - large_expense: monto del gasto supera el threshold
// - monthly_total: total del mes supera el threshold
// - budget_threshold: se evalúa en checkBudgetAlerts (necesita comparar con límite)
export async function checkAlertsForExpense(userId, expense) {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (!rules?.length) return;

  const amount = Number(expense.amount);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .gte('expense_date', monthStart);

  const monthTotal = (monthExpenses || []).reduce((s, e) => s + Number(e.amount), 0);

  for (const rule of rules) {
    if (rule.type === 'large_expense' && amount >= Number(rule.threshold)) {
      await notify(userId, rule.type,
        'Gasto grande detectado',
        `"${expense.description}" por $${amount.toFixed(2)} supera tu umbral de $${Number(rule.threshold).toFixed(2)}`);
    } else if (rule.type === 'monthly_total' && monthTotal >= Number(rule.threshold)) {
      await notify(userId, rule.type,
        'Límite mensual alcanzado',
        `Llevas $${monthTotal.toFixed(2)} gastados este mes (umbral: $${Number(rule.threshold).toFixed(2)})`);
    }
  }

  // También revisar presupuestos por si este gasto cruzó el umbral
  await checkBudgetAlerts(userId);
}

// Compara gasto del mes por categoría contra budgets y alert_threshold.
export async function checkBudgetAlerts(userId) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: budgets } = await supabase
    .from('budgets')
    .select('*, categories(name)')
    .eq('user_id', userId);
  if (!budgets?.length) return 0;

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category_id')
    .eq('user_id', userId)
    .gte('expense_date', monthStart);

  const spent = {};
  for (const e of expenses || []) {
    if (e.category_id) spent[e.category_id] = (spent[e.category_id] || 0) + Number(e.amount);
  }

  let created = 0;
  for (const b of budgets) {
    const s = spent[b.category_id] || 0;
    const pct = (s / Number(b.monthly_limit)) * 100;
    if (pct >= Number(b.alert_threshold) && s > 0) {
      // Evitar duplicados: solo notificar si no existe una igual no leída hoy
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'budget_threshold')
        .eq('is_read', false)
        .gte('created_at', `${today}T00:00:00`)
        .ilike('message', `%${b.categories?.name || ''}%`)
        .limit(1);
      if (existing?.length) continue;

      await notify(userId, 'budget_threshold',
        'Presupuesto por alcanzar',
        `Has usado el ${Math.round(pct)}% del presupuesto de "${b.categories?.name || 'categoría'}" este mes`);
      created++;
    }
  }
  return created;
}
