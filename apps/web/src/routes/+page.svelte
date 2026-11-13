<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let expenses = $state([]);
  let budgets = $state([]);
  let notifications = $state([]);
  let categories = $state([]);
  let loadingData = $state(true);
  let error = $state('');

  const now = new Date();
  const monthName = now.toLocaleDateString('es', { month: 'long', year: 'numeric' });

  onMount(async () => {
    try {
      const [e, b, n, c] = await Promise.all([
        api(`/expenses?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
        api('/budgets'),
        api('/alerts/notifications'),
        api('/expenses/categories')
      ]);
      expenses = e.expenses;
      budgets = b.budgets;
      notifications = n.notifications;
      categories = c.categories;
      // Auto-sembrar categorías por defecto si el usuario no tiene
      if (!categories.length) {
        const defaults = [
          { name: 'Comida', icon: '🍔', color: '#f59e0b' },
          { name: 'Transporte', icon: '🚗', color: '#3b82f6' },
          { name: 'Vivienda', icon: '🏠', color: '#8b5cf6' },
          { name: 'Ocio', icon: '🎮', color: '#ec4899' },
          { name: 'Salud', icon: '💊', color: '#22c55e' },
          { name: 'Otros', icon: '📦', color: '#64748b' }
        ];
        for (const d of defaults) {
          const r = await api('/expenses/categories', { method: 'POST', body: d });
          categories.push(r.category);
        }
      }
    } catch (err) {
      error = err.message;
    } finally {
      loadingData = false;
    }
  });

  const totalMonth = $derived(expenses.reduce((s, e) => s + Number(e.amount), 0));
  const unread = $derived(notifications.filter((n) => !n.is_read));
  const byCategory = $derived.by(() => {
    const map = {};
    for (const e of expenses) {
      const name = e.categories?.name || 'Sin categoría';
      map[name] = (map[name] || 0) + Number(e.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  });
  const maxCat = $derived(Math.max(...byCategory.map(([, v]) => v), 1));
</script>

<h1>Dashboard</h1>
<p class="muted">Resumen de {monthName}</p>

{#if error}<p class="error">{error}</p>{/if}
{#if loadingData}<p class="muted">Cargando...</p>{/if}

{#if !loadingData}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:1.5rem">
    <div class="card">
      <div class="muted">Gastado este mes</div>
      <div style="font-size:1.8rem;font-weight:700">${totalMonth.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="muted">Gastos registrados</div>
      <div style="font-size:1.8rem;font-weight:700">{expenses.length}</div>
    </div>
    <div class="card">
      <div class="muted">Alertas sin leer</div>
      <div style="font-size:1.8rem;font-weight:700">{unread.length}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem">
    <div class="card">
      <h3>Presupuestos del mes</h3>
      {#if !budgets.length}
        <p class="muted">No tienes presupuestos. <a href="/presupuestos">Crear uno</a></p>
      {:else}
        {#each budgets as b (b.id)}
          <div style="margin-bottom:0.9rem">
            <div style="display:flex;justify-content:space-between;font-size:0.9rem">
              <span>{b.categories?.icon} {b.categories?.name}</span>
              <span class="muted">${Number(b.spent).toFixed(0)} / ${Number(b.monthly_limit).toFixed(0)} ({b.percent}%)</span>
            </div>
            <div style="background:var(--surface-2);border-radius:6px;height:8px;margin-top:4px">
              <div style="background:{b.percent >= b.alert_threshold ? 'var(--danger)' : 'var(--primary)'};height:8px;border-radius:6px;width:{b.percent}%"></div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="card">
      <h3>Gasto por categoría</h3>
      {#if !byCategory.length}
        <p class="muted">Sin gastos este mes.</p>
      {:else}
        {#each byCategory as [name, value] (name)}
          <div style="margin-bottom:0.7rem">
            <div style="display:flex;justify-content:space-between;font-size:0.9rem">
              <span>{name}</span>
              <span class="muted">${Number(value).toFixed(2)}</span>
            </div>
            <div style="background:var(--surface-2);border-radius:6px;height:6px;margin-top:3px">
              <div style="background:var(--primary);height:6px;border-radius:6px;width:{(value / maxCat) * 100}%"></div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="card">
      <h3>Últimas notificaciones</h3>
      {#if !notifications.length}
        <p class="muted">Sin notificaciones.</p>
      {:else}
        {#each notifications.slice(0, 6) as n (n.id)}
          <div style="padding:0.5rem 0;border-bottom:1px solid var(--border);opacity:{n.is_read ? 0.6 : 1}">
            <strong style="font-size:0.9rem">{n.title}</strong>
            <div class="muted" style="font-size:0.82rem">{n.message}</div>
          </div>
        {/each}
        <p style="margin-top:0.75rem"><a href="/alertas">Ver todas →</a></p>
      {/if}
    </div>
  </div>
{/if}
