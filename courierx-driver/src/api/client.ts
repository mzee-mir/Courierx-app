import axios, { InternalAxiosRequestConfig } from 'axios';
import EventEmitter from 'eventemitter3';

export const authEventEmitter = new EventEmitter();

// Self-contained UUID generator avoiding dependencies / native issues
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 60000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const mutationMethods = ['post', 'put', 'patch', 'delete'];
  if (config.method && mutationMethods.includes(config.method.toLowerCase())) {
    if (config.headers && !config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = generateUUID();
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // SECURITY RULE: If driver is unauthorized or role is rejected, force logout
    if (error.response?.status === 401 || error.response?.status === 403) {
      authEventEmitter.emit('UNAUTHORIZED_ACCESS');
    }
    return Promise.reject(error);
  }
);

export const setAuthHeader = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};