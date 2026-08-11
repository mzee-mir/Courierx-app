import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { storage } from '../utils/storage';
import { api, authEventEmitter, setAuthHeader } from '../api/client';
import { AppState } from 'react-native';

type DriverStatus = 'INITIALIZING' | 'UNAUTHENTICATED' | 'PENDING_APPROVAL' | 'AUTHORIZED';

interface AuthState {
  driver: any | null;
  token: string | null;
  status: DriverStatus;
  signIn: (token: string, driverData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<DriverStatus>('INITIALIZING');

  const signOut = async () => {
    setStatus('UNAUTHENTICATED');
    setDriver(null);
    setToken(null);
    setAuthHeader(null);
    await storage.clearAuth();
  };
  const signIn = async (newToken: string, userData: any) => {
    /**
     * ARCHITECTURAL FIX: 
     * Backend now returns 'roles' as an array. We must check for inclusion.
     */
    const roles = userData.roles || [];
    const hasDriverRole = roles.includes('driver');

    if (!hasDriverRole) {
      setStatus('UNAUTHENTICATED');
      // This is what caused your error. We only throw if the role is missing.
      throw new Error('NOT_A_DRIVER_ACCOUNT');
    }

    setAuthHeader(newToken);
    setToken(newToken);
    setDriver(userData);

    /**
     * FEATURE: The Onboarding Gate
     * 'isVerified' is the authoritative flag for professional access.
     */
    if (userData.isVerified === true) {
      setStatus('AUTHORIZED');
    } else {
      setStatus('PENDING_APPROVAL');
    }

    await storage.saveAuth(newToken, userData);
  };

  useEffect(() => {
    authEventEmitter.on('UNAUTHORIZED_ACCESS', signOut);

    const initialize = async () => {
      const { token: cachedToken, user: cachedUser } = await storage.getAuth();

      if (!cachedToken || !cachedUser) {
        setStatus('UNAUTHENTICATED');
        return;
      }

      setAuthHeader(cachedToken);

      try {
        // Sync with backend to get the latest 'isVerified' status
        const response = await api.get('/profile'); 
        const freshUser = response.data.profile;

        // Check array for role
        if (!freshUser.roles.includes('driver')) {
            await signOut();
            return;
        }

        setToken(cachedToken);
        setDriver(freshUser);
        
        // Gate decision based on Admin approval
        setStatus(freshUser.isVerified ? 'AUTHORIZED' : 'PENDING_APPROVAL');
      } catch (error) {
        // Fallback to cache for offline resilience
        setToken(cachedToken);
        setDriver(cachedUser);
        setStatus(cachedUser.isVerified ? 'AUTHORIZED' : 'PENDING_APPROVAL');
      }
    };

    initialize();
    return () => { authEventEmitter.off('UNAUTHORIZED_ACCESS', signOut); };
  }, []);

  useEffect(() => {
  const sub = AppState.addEventListener('change', async state => {
    if (state === 'active' && token) {
      try {
        const res = await api.get('/profile');
        const freshUser = res.data.profile;
        setDriver(freshUser);
        setStatus(freshUser.isVerified ? 'AUTHORIZED' : 'PENDING_APPROVAL');
        await storage.saveAuth(token, freshUser);
      } catch {}
    }
  });

  return () => sub.remove();
}, [token])

useEffect(() => {
  if (status !== 'PENDING_APPROVAL') return;

  const interval = setInterval(async () => {
    try {
      const res = await api.get('/profile');
      const freshUser = res.data.profile;
      if (freshUser.isVerified) {
        setDriver(freshUser);
        setStatus('AUTHORIZED');
        await storage.saveAuth(token!, freshUser);
      }
    } catch {}
  }, 30000);

  return () => clearInterval(interval);
}, [status]);


  const value = useMemo(() => ({
    driver,
    token,
    status,
    signIn,
    signOut
  }), [driver, token, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within a Driver AuthProvider');
  return context;
};