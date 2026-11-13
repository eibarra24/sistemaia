<script>
  import { goto } from '$app/navigation';
  import { register } from '$lib/auth.js';

  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let error = $state('');
  let submitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    if (password !== confirm) {
      error = 'Las contraseñas no coinciden';
      return;
    }
    submitting = true;
    try {
      await register(email, password);
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
    <h1 style="margin-top:0">Crear cuenta</h1>
    <p class="muted">Control de gastos personales</p>
    <form onsubmit={handleSubmit}>
      <div class="field">
        <label for="email">Correo</label>
        <input id="email" class="input" type="email" bind:value={email} required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Contraseña (mín. 8 caracteres)</label>
        <input id="password" class="input" type="password" bind:value={password} required minlength="8" autocomplete="new-password" />
      </div>
      <div class="field">
        <label for="confirm">Confirmar contraseña</label>
        <input id="confirm" class="input" type="password" bind:value={confirm} required minlength="8" autocomplete="new-password" />
      </div>
      {#if error}<p class="error">{error}</p>{/if}
      <button class="btn" type="submit" disabled={submitting} style="width:100%">
        {submitting ? 'Registrando...' : 'Registrarme'}
      </button>
    </form>
    <p class="muted" style="margin-top:1rem;text-align:center">
      ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
    </p>
  </div>
</div>
