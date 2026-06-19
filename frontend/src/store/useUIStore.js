import { create } from 'zustand';

/**
 * Store de Zustand para manejar el estado global de componentes de interfaz (UI),
 * como modales y vistas flotantes.
 */
const useUIStore = create((set) => ({
  activeChord: null,
  isAuthModalOpen: false,
  isImportModalOpen: false,

  setActiveChord: (chord) => set({ activeChord: chord }),
  setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
  setImportModalOpen: (isOpen) => set({ isImportModalOpen: isOpen }),
  closeChordModal: () => set({ activeChord: null }),
}));

export default useUIStore;
