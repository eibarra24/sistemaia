<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let rules = $state([]);
  let notifications = $state([]);
  let loadingData = $state(true);
  let error = $state('');

  let form = $state({ type: 'large_expense', threshold: '', category_id: '' });
  let saving = $state(false);
  let formError = $state('');

  const typeLabels = {
    budget_threshold: 'Presupuesto de categoría supera %',
    large_expense: 'Gasto individual supera monto',
    monthly_total: 'Total mensual supera monto'
  };

  async function load() {
    loadingData = true;
    try {
      const [a, n] = await Promise.all([api('/alerts'), api('/alerts/notifications')]);
      rules = a.alerts;
      notifications = n.notifications;
    } catch (err) {
      error = err.message;
    } finally {
      loadingData = false;
    }
  }

  onMount(load);

  async function handleSubmit(e) {
    e.preventDefault();
    formError = '';
    saving = true;
    try {
      await api('/alerts', {
        method: 'POST',
        body: {
          type: form.type,
          threshold: Number(form.threshold),
          category_id: form.category_id || null
        }
      });
      form = { type: 'large_expense', threshold: '', category_id: '' };
      await load();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function toggle(id, active) {
    await api(`/alerts/${id}`, { method: 'PUT', body: { is_active: !active } });
    rules = rules.map((r) => (r.id === id ? { ...r, is_active: !active } : r));
  }

  async function remove(id) {
    if (!confirm('¿Eliminar esta regla?')) return;
    await api(`/alerts/${id}`, { method: 'DELETE' });
    rules = rules.filter((x) => x.id !== id);
  }

  async function markRead(id) {
    await api(`/alerts/notifications/${id}/read`, { method: 'POST' });
    notifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await api('/alerts/notifications/read-all', { method: 'POST' });
    notifications = notifications.map((n) => ({ ...n, is_read: true }));
  }
</script>

<h1>Alertas</h1>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:1rem">
  <div>
    <div class="card" style="margin-bottom:1rem">
      <h3 style="margin-top:0">Nueva regla de alerta</h3>
      <form onsubmit={handleSubmit}>
        <div class="field">
          <label for="type">Tipo</label>
          <select id="type" class="input" bind:value={form.type}>
            {#each Object.entries(typeLabels) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="thresh">
            {form.type === 'budget_threshold' ? 'Umbral (%)' : 'Monto límite ($)'}
          </label>
          <input id="thresh" class="input" type="number" step="0.01" min="0.01" bind:value={form.threshold} required />
        </div>
        {#if formError}<p class="error">{formError}</p>{/if}
        <button class="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear regla'}</button>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-top:0">Reglas activas</h3>
      {#if loadingData}<p class="muted">Cargando...</p>{/if}
      {#if !loadingData && !rules.length}<p class="muted">Sin reglas configuradas.</p>{/if}
      {#each rules as r (r.id)}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:0.9rem">{typeLabels[r.type] || r.type}</div>
            <div class="muted" style="font-size:0.8rem">
              Umbral: {r.type === 'budget_threshold' ? `${r.threshold}%` : `$${Number(r.threshold).toFixed(2)}`}
              {#if r.categories?.name}· {r.categories.icon} {r.categories.name}{/if}
            </div>
          </div>
          <div>
            <button class="btn secondary small" onclick={() => toggle(r.id, r.is_active)}>
              {r.is_active ? 'Activa' : 'Inactiva'}
            </button>
            <button class="btn danger small" style="margin-left:0.4rem" onclick={() => remove(r.id)}>✕</button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin-top:0">Notificaciones</h3>
      {#if notifications.some((n) => !n.is_read)}
        <button class="btn secondary small" onclick={markAllRead}>Marcar todas leídas</button>
      {/if}
    </div>
    {#if loadingData}<p class="muted">Cargando...</p>{/if}
    {#if !loadingData && !notifications.length}<p class="muted">Sin notificaciones.</p>{/if}
    {#each notifications as n (n.id)}
      <div style="padding:0.7rem 0;border-bottom:1px solid var(--border);opacity:{n.is_read ? 0.55 : 1}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:0.9rem">{!n.is_read ? '🔔 ' : ''}{n.title}</strong>
          <span class="muted" style="font-size:0.75rem">{new Date(n.created_at).toLocaleString('es')}</span>
        </div>
        <div style="font-size:0.85rem;margin-top:0.2rem">{n.message}</div>
        {#if !n.is_read}
          <button class="btn secondary small" style="margin-top:0.4rem" onclick={() => markRead(n.id)}>Marcar leída</button>
        {/if}
      </div>
    {/each}
  </div>
</div>

{#if error}<p class="error">{error}</p>{/if}
