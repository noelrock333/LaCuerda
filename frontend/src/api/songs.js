import { apiFetch } from './client.js';

export async function searchSongsApi(query) {
  return await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
}

export async function getGroupedByArtistApi() {
  return await apiFetch('/api/songs/grouped-by-artist');
}

export async function getArtistsByLetterApi(letter, page = 1) {
  return await apiFetch(`/api/artists/by-letter/${letter}?page=${page}`);
}

export async function getArtistDetailApi(artistSlug) {
  return await apiFetch(`/api/artists/${artistSlug}`);
}

export async function getSongDetailApi(artistSlug, songSlug) {
  return await apiFetch(`/api/songs/${artistSlug}/${songSlug}`);
}

export async function getVersionDetailApi(artistSlug, versionSlug) {
  return await apiFetch(`/api/version/${artistSlug}/${versionSlug}`);
}

export async function updateVersionApi(id, data) {
  return await apiFetch(`/api/version/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function getVersionTxtApi(artistSlug, versionSlug) {
  return await apiFetch(`/TXT/${artistSlug}/${versionSlug}`);
}

export async function importSongApi(url, downloadAllVersions = false) {
  return await apiFetch('/api/songs/import', {
    method: 'POST',
    body: JSON.stringify({ url, downloadAllVersions })
  });
}

export async function autoImportSongApi(artistSlug, slug, type) {
  return await apiFetch('/api/songs/auto-import', {
    method: 'POST',
    body: JSON.stringify({ artistSlug, slug, type })
  });
}
