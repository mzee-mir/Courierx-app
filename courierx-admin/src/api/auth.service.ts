// src/api/auth.service.ts
import api from './axios';
import type { AuthResponse } from '../types/user';

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/admin/login', { email, password });
    return data;
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },

  verifySudo: async (password: string) => {
    const { data } = await api.post('/auth/verify-sudo', { password });
    // This returns { success: true, sudoToken: "..." }
    return data.sudoToken;
  }
};