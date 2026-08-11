import api from './axios';
import type { AuthResponse, UserRole } from '../types/auth';


const ALLOWED_PARTNER_ROLES: string[] = [
  'partner_owner',
  'partner_ops',
  'partner_readonly',
  'super_admin'
];


export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/partner/login', { email, password });

    // 👈 LOGICAL GATE: Verify role before allowing entry
    const hasPermission = data.user.roles.some(role =>
      ALLOWED_PARTNER_ROLES.includes(role)
    );


    if (!hasPermission) {
      throw new Error('ACCESS_DENIED: This portal is restricted to logistics partners.');
    }


    return data;
  },


  logout: () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_user');
    sessionStorage.clear();
    window.location.href = '/login';
  },


  /**
   * verifySudo: Step-Up Authentication.
   * Converts a valid password into a 5-minute sudo_token.
   */
  verifySudo: async (password: string) => {
    const { data } = await api.post('/partner/auth/verify-sudo', { password });
    return data.sudoToken; // Returns the JWT with { sudo: true }
  }
};
