<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let expenses = $state([]);
  let categories = $state([]);
  let loadingData = $state(true);
  let error = $state('');

  let showForm = $state(false);
  let form = $state({ description: '', amount: '', category_id: '', expense_date: '', payment_method: 'EFECTIVO' });

  const paymentMethods = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TDC', label: 'TDC (Tarjeta de crédito)' },
    { value: 'TDEBITO', label: 'T. Débito' },
    { value: 'TRANSFERENCIA', label: 'Transferencia' }
  ];

  const paymentLabels = Object.fromEntries(paymentMethods.map((m) => [m.value, m.label]));
  let saving = $state(false);
  let formError = $state('');

  async function load() {
    loadingData = true;
    try {
      const [e, c] = await Promise.all([
        api('/expenses'),
        api('/expenses/categories')
      ]);
      expenses = e.expenses;
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
      await api('/expenses', {
        method: 'POST',
        body: {
          description: form.description,
          amount: Number(form.amount),
          category_id: form.category_id || null,
          expense_date: form.expense_date || undefined,
          payment_method: form.payment_method || null
        }
      });
      showForm = false;
      form = { description: '', amount: '', category_id: '', expense_date: '', payment_method: 'EFECTIVO' };
      await load();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await api(`/expenses/${id}`, { method: 'DELETE' });
    expenses = expenses.filter((x) => x.id !== id);
  }
</script>

<div style="display:flex;justify-content:space-between;align-items:center">
  <h1>Gastos</h1>
  <button class="btn" onclick={() => (showForm = !showForm)}>
    {showForm ? 'Cancelar' : '+ Nuevo gasto'}
  </button>
</div>

{#if showForm}
  <div class="card" style="margin-bottom:1.5rem">
    <form onsubmit={handleSubmit}>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
        <div class="field">
          <label for="desc">Descripción</label>
          <input id="desc" class="input" bind:value={form.description} required maxlength="200" placeholder="Supermercado" />
        </div>
        <div class="field">
          <label for="amount">Monto</label>
          <input id="amount" class="input" type="number" step="0.01" min="0.01" bind:value={form.amount} required placeholder="0.00" />
        </div>
        <div class="field">
          <label for="cat">Categoría</label>
          <select id="cat" class="input" bind:value={form.category_id}>
            <option value="">Sin categoría</option>
            {#each categories as c (c.id)}
              <option value={c.id}>{c.icon} {c.name}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="date">Fecha</label>
          <input id="date" class="input" type="date" bind:value={form.expense_date} />
        </div>
        <div class="field">
          <label for="pay">Método de pago</label>
          <select id="pay" class="input" bind:value={form.payment_method}>
            {#each paymentMethods as m (m.value)}
              <option value={m.value}>{m.label}</option>
            {/each}
          </select>
        </div>
      </div>
      {#if formError}<p class="error">{formError}</p>{/if}
      <button class="btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </form>
  </div>
{/if}

{#if error}<p class="error">{error}</p>{/if}
{#if loadingData}<p class="muted">Cargando...</p>{/if}

<div class="card">
  {#if !loadingData && !expenses.length}
    <p class="muted">No hay gastos registrados. ¡Agrega el primero!</p>
  {:else}
    <table style="width:100%;border-collapse:collapse;font-size:0.92rem">
      <thead>
        <tr style="text-align:left;color:var(--muted);border-bottom:1px solid var(--border)">
          <th style="padding:0.5rem">Fecha</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th>Pago</th>
          <th style="text-align:right">Monto</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each expenses as e (e.id)}
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:0.6rem 0.5rem">{e.expense_date}</td>
            <td>{e.description}</td>
            <td><span class="badge">{e.categories?.icon || '📦'} {e.categories?.name || '—'}</span></td>
            <td><span class="badge">{paymentLabels[e.payment_method] || '—'}</span></td>
            <td style="text-align:right;font-weight:600">${Number(e.amount).toFixed(2)}</td>
            <td style="text-align:right">
              <button class="btn danger small" onclick={() => remove(e.id)}>✕</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
