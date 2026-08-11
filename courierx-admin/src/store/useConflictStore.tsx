import { create } from 'zustand'; // You have Redux/Toolkit, but for simple global UI, Zustand is lighter. 
// If you prefer to use your existing Redux, this can be a simple slice.

interface ConflictState {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useConflictStore = create<ConflictState>((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));