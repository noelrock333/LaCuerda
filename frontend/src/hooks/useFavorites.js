import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFavoritesApi,
  addFavoriteApi,
  removeFavoriteApi,
  getFavoriteStatusApi,
  updateFavoriteAwesomeApi,
  importFavoritesApi
} from '../api/favorites.js';
import useAuthStore from '../store/useAuthStore.js';

export function useFavoritesQuery() {
  const token = useAuthStore((state) => state.token);
  
  return useQuery({
    queryKey: ['favorites', token],
    queryFn: getFavoritesApi,
    enabled: !!token,
    staleTime: 1000 * 60 * 2 // 2 minutos
  });
}

export function useFavoriteStatusQuery(songId) {
  const token = useAuthStore((state) => state.token);
  
  return useQuery({
    queryKey: ['favorites', 'status', songId, token],
    queryFn: () => getFavoriteStatusApi(songId),
    enabled: !!songId,
    staleTime: 1000 * 60 * 5
  });
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ songId, isFavorite }) => {
      if (isFavorite) {
        return await removeFavoriteApi(songId);
      } else {
        return await addFavoriteApi(songId);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'status', variables.songId] });
    }
  });
}

export function useAwesomeMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ songId, isAwesome }) => updateFavoriteAwesomeApi(songId, isAwesome),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'status', variables.songId] });
    }
  });
}

export function useImportFavoritesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text) => importFavoritesApi(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });
}
