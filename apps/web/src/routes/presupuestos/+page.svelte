<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let budgets = $state([]);
  let categories = $state([]);
  let loadingData = $state(true);
  let error = $state('');

  let form = $state({ category_id: '', monthly_limit: '', alert_threshold: 80 });
  let saving = $state(false);
  let formError = $state('');

  async function load() {
    loadingData = true;
    try {
      const [b, c] = await Promise.all([api('/budgets'), api('/expenses/categories')]);
      budgets = b.budgets;
      categories = c.categories;
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
      await api('/budgets', {
        method: 'POST',
        body: {
          category_id: form.category_id,
          monthly_limit: Number(form.monthly_limit),
          alert_threshold: Number(form.alert_threshold)
        }
      });
      form = { category_id: '', monthly_limit: '', alert_threshold: 80 };
      await load();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    await api(`/budgets/${id}`, { method: 'DELETE' });
    budgets = budgets.filter((x) => x.id !== id);
  }
</script>

<h1>Presupuestos</h1>
<p class="muted">Define un límite mensual por categoría. Recibirás alertas al alcanzar el porcentaje configurado.</p>

<div class="card" style="margin-bottom:1.5rem">
  <h3 style="margin-top:0">Nuevo presupuesto</h3>
  <form onsubmit={handleSubmit}>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;align-items:end">
      <div class="field">
        <label for="cat">Categoría</label>
        <select id="cat" class="input" bind:value={form.category_id} required>
          <option value="" disabled>Selecciona...</option>
          {#each categories as c (c.id)}
            <option value={c.id}>{c.icon} {c.name}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <label for="limit">Límite mensual ($)</label>
        <input id="limit" class="input" type="number" step="0.01" min="0.01" bind:value={form.monthly_limit} required placeholder="500.00" />
      </div>
      <div class="field">
        <label for="thresh">Alerta al (%)</label>
        <input id="thresh" class="input" type="number" min="1" max="100" bind:value={form.alert_threshold} required />
      </div>
      <button class="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
    {#if formError}<p class="error">{formError}</p>{/if}
  </form>
</div>

{#if error}<p class="error">{error}</p>{/if}
{#if loadingData}<p class="muted">Cargando...</p>{/if}

<div class="card">
  {#if !loadingData && !budgets.length}
    <p class="muted">No hay presupuestos configurados.</p>
  {:else}
    {#each budgets as b (b.id)}
      <div style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>{b.categories?.icon} {b.categories?.name}</strong>
          <span>
            <span class="muted">${Number(b.spent).toFixed(2)} / ${Number(b.monthly_limit).toFixed(2)}</span>
            <span class="badge" style="margin-left:0.5rem">{b.percent}%</span>
            <button class="btn danger small" style="margin-left:0.5rem" onclick={() => remove(b.id)}>✕</button>
          </span>
        </div>
        <div style="background:var(--surface-2);border-radius:6px;height:10px;margin-top:8px">
          <div style="background:{b.percent >= b.alert_threshold ? 'var(--danger)' : 'var(--primary)'};height:10px;border-radius:6px;width:{b.percent}%"></div>
        </div>
        <div class="muted" style="font-size:0.8rem;margin-top:4px">
          Alerta al {b.alert_threshold}% del límite
        </div>
      </div>
    {/each}
  {/if}
</div>
