import { writable } from 'svelte/store';
import { getToken, setToken, api } from './api.js';

export const user = writable(null);
export const loading = writable(true);

export async function initAuth() {
  if (!getToken()) {
    loading.set(false);
    return;
  }
  try {
    const { user: u } = await api('/auth/me');
    user.set(u);
  } catch {
    setToken(null);
  } finally {
    loading.set(false);
  }
}

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  setToken(data.token);
  user.set(data.user);
  return data.user;
}

export async function register(email, password) {
  const data = await api('/auth/register', { method: 'POST', body: { email, password } });
  setToken(data.token);
  user.set(data.user);
  return data.user;
}

export function logout() {
  setToken(null);
  user.set(null);
}
