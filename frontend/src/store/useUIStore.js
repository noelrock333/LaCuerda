import { create } from 'zustand';

/**
 * Store de Zustand para manejar el estado global de componentes de interfaz (UI),
 * como modales y vistas flotantes.
 */
const useUIStore = create((set) => ({
  activeChord: null,
  isAuthModalOpen: false,
  
  setActiveChord: (chord) => set({ activeChord: chord }),
  setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
  closeChordModal: () => set({ activeChord: null }),
}));

export default useUIStore;
