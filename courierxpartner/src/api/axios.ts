import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/useAuthStore';


const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 1. Identity Guard
  const token = localStorage.getItem('partner_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
    
    const decoded: any = jwtDecode(token);
    const currentTime = Date.now() / 1000;

    if (decoded.exp < currentTime) {
      // Token is already dead, don't even try to show the dashboard
      useAuthStore.getState().logout();
    }
  }


  // 2. Step-Up Security (Sudo)
  const sudoToken = sessionStorage.getItem('sudo_token');
  if (sudoToken && config.headers) {
    config.headers['X-Sudo-Token'] = sudoToken;
  }


  // 3. Physical Integrity: Mandatory Idempotency for Scans/Transitions
  const mutationMethods = ['post', 'patch', 'put', 'delete'];
  if (config.method && mutationMethods.includes(config.method.toLowerCase())) {
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = uuidv4();
    }
  }


  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;


    // 🚨 FIX: Handle Token Expiry (401) or Revocation (403)
    if (response?.status === 401 || (response?.status === 403 && response.data.error === 'AUTH_SESSION_REVOKED')) {


      // 1. Clear everything so the app "forgets" the user
      localStorage.removeItem('partner_token');
      localStorage.removeItem('partner_user');
      sessionStorage.clear();


      // 2. Alert the user (Optional)
      toast.error('SESSION_EXPIRED', { description: 'Security token invalid. Please log in again.' });


      // 3. Force redirect to login
      // We use window.location because it works outside of the React lifecycle
      setTimeout(() => {
        window.location.href = '/login?reason=expired';
      }, 1500);


      return Promise.reject(error);
    }


    // 409: Concurrency Conflict (Optimistic Locking)
    if (response?.status === 409) {
      toast.error('Sync Conflict', { description: 'Record modified by another agent. Refreshing...' });
      setTimeout(() => window.location.reload(), 2000);
    }


    if (error.response?.status === 429) {
      toast.error('TERMINAL_THROTTLED', {
        description: error.response.data.message || 'Too many requests. Slow down.'
      });
    }


    return Promise.reject(error);
  }
);


export default api;
