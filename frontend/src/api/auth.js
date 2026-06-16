import { apiFetch } from './client.js';

export async function loginApi({ username, password }) {
  return await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function registerApi({ username, password }) {
  return await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function logoutApi() {
  return await apiFetch('/api/auth/logout', {
    method: 'POST'
  });
}

export async function getMeApi() {
  return await apiFetch('/api/auth/me');
}
