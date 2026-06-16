import { create } from 'zustand';

/**
 * Store de Zustand para manejar la sesión del usuario (usuario y token).
 * Persiste el token en localStorage para mantener la sesión tras recargar.
 */
const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  
  login: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  
  setUser: (user) => set({ user }),
}));

export default useAuthStore;
