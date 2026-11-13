<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { user, loading, initAuth, logout } from '$lib/auth.js';

  const publicPaths = ['/login', '/register'];
  let ready = $state(false);

  onMount(async () => {
    await initAuth();
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    const path = get(page).url.pathname;
    const u = get(user);
    const isLoading = get(loading);
    if (!u && !isLoading && !publicPaths.includes(path)) {
      window.location.href = '/login';
    } else if (u && publicPaths.includes(path)) {
      window.location.href = '/';
    }
  });

  let showNav = $derived(ready && $user && !publicPaths.includes($page.url.pathname));
</script>

{#if $loading || !ready}
  <div style="display:flex;align-items:center;justify-content:center;height:100vh" class="muted">
    Cargando...
  </div>
{:else}
  {#if showNav}
    <nav style="display:flex;align-items:center;gap:1.5rem;padding:0.75rem 1.5rem;background:var(--surface);border-bottom:1px solid var(--border)">
      <strong style="color:var(--primary)">💰 SistemaIA</strong>
      <a href="/" class:active={$page.url.pathname === '/'}>Dashboard</a>
      <a href="/gastos" class:active={$page.url.pathname.startsWith('/gastos')}>Gastos</a>
      <a href="/ahorro" class:active={$page.url.pathname.startsWith('/ahorro')}>Ahorro</a>
      <a href="/presupuestos" class:active={$page.url.pathname === '/presupuestos'}>Presupuestos</a>
      <a href="/alertas" class:active={$page.url.pathname === '/alertas'}>Alertas</a>
      <a href="/geocercas" class:active={$page.url.pathname.startsWith('/geocercas')}>Geocercas</a>
      <span style="flex:1"></span>
      <span class="muted">{$user.email}</span>
      <button class="btn secondary small" onclick={logout}>Salir</button>
    </nav>
  {/if}
  <main style="max-width:1100px;margin:0 auto;padding:1.5rem">
    <slot />
  </main>
{/if}

<style>
  nav a { color: var(--muted); }
  nav a.active, nav a:hover { color: var(--text); text-decoration: none; }
</style>
