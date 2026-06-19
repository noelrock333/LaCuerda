import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchSongsApi,
  getGroupedByArtistApi,
  getArtistsByLetterApi,
  getArtistDetailApi,
  getSongDetailApi,
  getVersionDetailApi,
  updateVersionApi,
  getVersionTxtApi,
  importSongApi,
  autoImportSongApi
} from '../api/songs.js';

function isNotFoundError(error) {
  const msg = error?.message?.toLowerCase() || '';
  return msg.includes('no encontrad') || msg.includes('error http: 404');
}

async function tryAutoImport(artistSlug, slug, type) {
  try {
    return await autoImportSongApi(artistSlug, slug, type);
  } catch (error) {
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('no se encontr') || msg.toLowerCase().includes('lacuerda')) {
      throw new Error(msg);
    }
    throw new Error('No se encontró esta canción en LaCuerda.net');
  }
}

async function fetchSongDetailWithAutoImport(artistSlug, songSlug) {
  try {
    return await getSongDetailApi(artistSlug, songSlug);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    const autoResult = await tryAutoImport(artistSlug, songSlug, 'song');
    if (autoResult.status === 'imported' || autoResult.status === 'exists') {
      return await getSongDetailApi(artistSlug, songSlug);
    }
    throw new Error('No se encontró esta canción en LaCuerda.net');
  }
}

async function fetchVersionDetailWithAutoImport(artistSlug, versionSlug) {
  try {
    return await getVersionDetailApi(artistSlug, versionSlug);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    const autoResult = await tryAutoImport(artistSlug, versionSlug, 'version');
    if (autoResult.status === 'imported' || autoResult.status === 'exists') {
      return await getVersionDetailApi(artistSlug, versionSlug);
    }
    throw new Error('No se encontró esta canción en LaCuerda.net');
  }
}

export function useSearchQuery(query) {
  return useQuery({
    queryKey: ['songs', 'search', query],
    queryFn: () => searchSongsApi(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5
  });
}

export function useCatalogQuery() {
  return useQuery({
    queryKey: ['songs', 'catalog'],
    queryFn: getGroupedByArtistApi,
    staleTime: 1000 * 60 * 10
  });
}

export function useArtistsByLetterQuery(letter, page = 1) {
  return useQuery({
    queryKey: ['artists', 'by-letter', letter, page],
    queryFn: () => getArtistsByLetterApi(letter, page),
    staleTime: 1000 * 60 * 5
  });
}

export function useArtistDetailQuery(artistSlug) {
  return useQuery({
    queryKey: ['artists', 'detail', artistSlug],
    queryFn: () => getArtistDetailApi(artistSlug),
    staleTime: 1000 * 60 * 5
  });
}

export function useSongDetailQuery(artistSlug, songSlug) {
  return useQuery({
    queryKey: ['songs', 'detail', artistSlug, songSlug],
    queryFn: () => fetchSongDetailWithAutoImport(artistSlug, songSlug),
    staleTime: 1000 * 60 * 5,
    retry: false
  });
}

export function useVersionDetailQuery(artistSlug, versionSlug) {
  return useQuery({
    queryKey: ['version', 'detail', artistSlug, versionSlug],
    queryFn: () => fetchVersionDetailWithAutoImport(artistSlug, versionSlug),
    staleTime: 1000 * 60 * 5,
    retry: false
  });
}

export function useVersionTxtQuery(artistSlug, versionSlug) {
  return useQuery({
    queryKey: ['version', 'txt', artistSlug, versionSlug],
    queryFn: () => getVersionTxtApi(artistSlug, versionSlug),
    staleTime: 1000 * 60 * 10
  });
}

export function useUpdateVersionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateVersionApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['version', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['version', 'txt'] });
      queryClient.invalidateQueries({ queryKey: ['artists', 'detail'] });
    }
  });
}

export function useImportSongMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, downloadAllVersions }) => importSongApi(url, downloadAllVersions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['songs', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['songs', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['version', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['artists', 'detail'] });
    }
  });
}
