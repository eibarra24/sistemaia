<script>
  import { goto } from '$app/navigation';
  import { login } from '$lib/auth.js';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let submitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    submitting = true;
    try {
      await login(email, password);
      goto('/');
    } catch (err) {
      error = err.message;
    } finally {
      submitting = false;
    }
  }
</script>

<div style="max-width:380px;margin:4rem auto">
  <div class="card">
    <h1 style="margin-top:0">💰 SistemaIA</h1>
    <p class="muted">Control de gastos personales</p>
    <form onsubmit={handleSubmit}>
      <div class="field">
        <label for="email">Correo</label>
        <input id="email" class="input" type="email" bind:value={email} required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <input id="password" class="input" type="password" bind:value={password} required minlength="8" autocomplete="current-password" />
      </div>
      {#if error}<p class="error">{error}</p>{/if}
      <button class="btn" type="submit" disabled={submitting} style="width:100%">
        {submitting ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
    <p class="muted" style="margin-top:1rem;text-align:center">
      ¿No tienes cuenta? <a href="/register">Regístrate</a>
    </p>
  </div>
</div>
