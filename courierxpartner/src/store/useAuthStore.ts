import { create } from 'zustand';
import type { User } from '../types/auth';


interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}


export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('partner_user') || 'null'),
  token: localStorage.getItem('partner_token'),
  setAuth: (user, token) => {
    localStorage.setItem('partner_user', JSON.stringify(user));
    localStorage.setItem('partner_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.clear();
    set({ user: null, token: null });
  },
}));
