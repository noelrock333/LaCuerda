import { apiFetch } from './client.js';

export async function getFavoritesApi() {
  return await apiFetch('/api/favorites');
}

export async function addFavoriteApi(songId) {
  return await apiFetch('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId })
  });
}

export async function removeFavoriteApi(songId) {
  return await apiFetch(`/api/favorites/${songId}`, {
    method: 'DELETE'
  });
}

export async function getFavoriteStatusApi(songId) {
  return await apiFetch(`/api/favorites/status/${songId}`);
}

export async function updateFavoriteAwesomeApi(songId, isAwesome) {
  return await apiFetch(`/api/favorites/awesome/${songId}`, {
    method: 'PUT',
    body: JSON.stringify({ is_awesome: isAwesome })
  });
}
