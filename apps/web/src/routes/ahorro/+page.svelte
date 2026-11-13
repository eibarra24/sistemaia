<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let account = $state(null);
  let transactions = $state([]);
  let loadingData = $state(true);
  let error = $state('');
  let notice = $state('');

  let showDeposit = $state(false);
  let showWithdraw = $state(false);
  let form = $state({ amount: '', note: '' });
  let saving = $state(false);
  let formError = $state('');

  const typeLabels = {
    deposit: 'Depósito',
    withdrawal: 'Retiro',
    interest: 'Rendimiento'
  };

  async function load() {
    loadingData = true;
    try {
      const data = await api('/savings');
      account = data.account;
      transactions = data.transactions;
    } catch (err) {
      error = err.message;
    } finally {
      loadingData = false;
    }
  }

  onMount(load);

  function resetForm() {
    form = { amount: '', note: '' };
    formError = '';
    showDeposit = false;
    showWithdraw = false;
  }

  async function handleSubmit(e, action) {
    e.preventDefault();
    formError = '';
    notice = '';
    saving = true;
    try {
      const result = await api(`/savings/${action}`, {
        method: 'POST',
        body: { amount: Number(form.amount), note: form.note || undefined }
      });
      account = result.account;
      const tx = await api('/savings');
      transactions = tx.transactions;
      resetForm();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function claimInterest() {
    notice = '';
    formError = '';
    try {
      const result = await api('/savings/interest', { method: 'POST' });
      account = result.account;
      const tx = await api('/savings');
      transactions = tx.transactions;
      notice = `Rendimiento cobrado: $${Number(result.transaction.amount).toFixed(2)}`;
    } catch (err) {
      notice = '';
      formError = err.message;
    }
  }
</script>

<h1>Caja de Ahorro</h1>
<p class="muted">Rendimiento anual del {account?.annual_rate ?? 10}% con capitalización mensual.</p>

{#if error}<p class="error">{error}</p>{/if}
{#if notice}<p class="badge" style="display:inline-block;padding:0.4rem 0.8rem">{notice}</p>{/if}

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:1.5rem">
  <div class="card">
    <p class="muted" style="margin:0">Saldo actual</p>
    <p style="font-size:1.6rem;font-weight:700;margin:0.25rem 0">${account ? Number(account.balance).toFixed(2) : '—'}</p>
  </div>
  <div class="card">
    <p class="muted" style="margin:0">Rendimiento acumulado</p>
    <p style="font-size:1.6rem;font-weight:700;margin:0.25rem 0;color:var(--primary)">
      {account ? `$${Number(account.accrued_interest).toFixed(2)}` : '—'}
    </p>
    <button class="btn secondary small" onclick={claimInterest} disabled={!account || account.accrued_interest <= 0}>
      Cobrar rendimiento
    </button>
  </div>
</div>

<div style="display:flex;gap:0.75rem;margin-bottom:1.5rem">
  <button class="btn" onclick={() => { showDeposit = !showDeposit; showWithdraw = false; formError = ''; }}>
    {showDeposit ? 'Cancelar' : '+ Depositar'}
  </button>
  <button class="btn secondary" onclick={() => { showWithdraw = !showWithdraw; showDeposit = false; formError = ''; }}>
    {showWithdraw ? 'Cancelar' : '− Retirar'}
  </button>
</div>

{#if showDeposit || showWithdraw}
  <div class="card" style="margin-bottom:1.5rem">
    <form onsubmit={(e) => handleSubmit(e, showDeposit ? 'deposit' : 'withdraw')}>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
        <div class="field">
          <label for="amount">Monto</label>
          <input id="amount" class="input" type="number" step="0.01" min="0.01" bind:value={form.amount} required placeholder="0.00" />
        </div>
        <div class="field">
          <label for="note">Nota (opcional)</label>
          <input id="note" class="input" bind:value={form.note} maxlength="200" placeholder="Ahorro quincena" />
        </div>
      </div>
      {#if formError}<p class="error">{formError}</p>{/if}
      <button class="btn" type="submit" disabled={saving}>
        {saving ? 'Procesando...' : showDeposit ? 'Depositar' : 'Retirar'}
      </button>
    </form>
  </div>
{/if}

<div class="card">
  <h2 style="margin-top:0">Movimientos</h2>
  {#if loadingData}<p class="muted">Cargando...</p>{/if}
  {#if !loadingData && !transactions.length}
    <p class="muted">Sin movimientos todavía. Haz tu primer depósito.</p>
  {:else}
    <table style="width:100%;border-collapse:collapse;font-size:0.92rem">
      <thead>
        <tr style="text-align:left;color:var(--muted);border-bottom:1px solid var(--border)">
          <th style="padding:0.5rem">Fecha</th>
          <th>Tipo</th>
          <th>Nota</th>
          <th style="text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>
        {#each transactions as t (t.id)}
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:0.6rem 0.5rem">{new Date(t.created_at).toLocaleDateString()}</td>
            <td><span class="badge">{typeLabels[t.type] || t.type}</span></td>
            <td class="muted">{t.note || '—'}</td>
            <td style="text-align:right;font-weight:600;color:{t.type === 'withdrawal' ? 'var(--danger, #ef4444)' : 'inherit'}">
              {t.type === 'withdrawal' ? '−' : '+'}${Number(t.amount).toFixed(2)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
