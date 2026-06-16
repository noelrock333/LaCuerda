import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchSongsApi,
  getGroupedByArtistApi,
  getArtistsByLetterApi,
  getArtistDetailApi,
  getSongDetailApi,
  getVersionDetailApi,
  updateVersionApi,
  getVersionTxtApi
} from '../api/songs.js';

export function useSearchQuery(query) {
  return useQuery({
    queryKey: ['songs', 'search', query],
    queryFn: () => searchSongsApi(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5 // 5 minutos
  });
}

export function useCatalogQuery() {
  return useQuery({
    queryKey: ['songs', 'catalog'],
    queryFn: getGroupedByArtistApi,
    staleTime: 1000 * 60 * 10 // 10 minutos
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
    queryFn: () => getSongDetailApi(artistSlug, songSlug),
    staleTime: 1000 * 60 * 5
  });
}

export function useVersionDetailQuery(artistSlug, versionSlug) {
  return useQuery({
    queryKey: ['version', 'detail', artistSlug, versionSlug],
    queryFn: () => getVersionDetailApi(artistSlug, versionSlug),
    staleTime: 1000 * 60 * 5
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
    onSuccess: (data, variables) => {
      // Invalida la canción, la versión y el catálogo para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['songs', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['version', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['version', 'txt'] });
      queryClient.invalidateQueries({ queryKey: ['artists', 'detail'] });
    }
  });
}
