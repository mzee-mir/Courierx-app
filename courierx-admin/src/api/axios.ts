import axios, { InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useConflictStore } from '../store/useConflictStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:2026/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * REQUEST INTERCEPTOR
 * Hardened for Traceability and Identity Persistence
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 1. Session Identity
  const token = localStorage.getItem('admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 2. Step-Up Authentication (Sudo Mode)
  const sudoToken = sessionStorage.getItem('sudo_token');
  if (sudoToken && config.headers) {
    config.headers['X-Sudo-Token'] = sudoToken;
  }

  // 3. Idempotency (Exactly-Once Execution)
  // Forces a unique key for every state-changing request
  const mutationMethods = ['post', 'put', 'patch', 'delete'];
  if (config.method && mutationMethods.includes(config.method.toLowerCase())) {
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = uuidv4();
    }
  }

  return config;
});

/**
 * RESPONSE INTERCEPTOR
 * Hardened for Data Integrity and Session Lifecycle
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    const traceId = response?.data?.requestId || 'N/A';

    // 403: Session Revoked (Live Status Check failed)
    if (response?.status === 403 && response.data.error === 'AUTH_SESSION_REVOKED') {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login?reason=session_revoked';
      return Promise.reject(error);
    }

    if (error.response?.status === 409) {
      // Use the store to trigger the UI
      useConflictStore.getState().openModal();
      
      // Return a custom rejection to stop the specific page's loading state
      return Promise.reject({ ...error, isConflict: true });
    }

    // 409: Concurrency Conflict (Optimistic Locking)
    if (response?.status === 409) {
      toast.error('Data Conflict', {
        description: 'This record was modified by another administrator. Page will refresh.',
      });
      setTimeout(() => window.location.reload(), 2000);
    }

    // 403: Sudo Expired or Required
    if (response?.status === 403 && response.data.error === 'SUDO_MODE_REQUIRED') {
      toast.error('Sudo Mode Required', { description: 'Please re-verify your password.' });
    }

    return Promise.reject(error);
  }
);

export default api;