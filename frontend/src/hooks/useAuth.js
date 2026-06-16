import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loginApi, registerApi, logoutApi, getMeApi } from '../api/auth.js';
import useAuthStore from '../store/useAuthStore.js';

export function useLoginMutation() {
  const login = useAuthStore((state) => state.login);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      login(data.user, data.token);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });
}

export function useRegisterMutation() {
  const login = useAuthStore((state) => state.login);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: registerApi,
    onSuccess: (data) => {
      login(data.user, data.token);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });
}

export function useLogoutMutation() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      logout();
      queryClient.clear();
    }
  });
}

export function useMeQuery() {
  const token = useAuthStore((state) => state.token);
  
  return useQuery({
    queryKey: ['user', token],
    queryFn: async () => {
      try {
        const data = await getMeApi();
        useAuthStore.getState().setUser(data.user);
        return data;
      } catch (err) {
        useAuthStore.getState().logout();
        throw err;
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5 // 5 minutos
  });
}
