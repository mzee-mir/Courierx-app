import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { storage } from '../utils/storage';
import { api, setAuthHeader, authEventEmitter } from '../api/client';

/**
 * AUTH_STATUS definitions:
 * INITIALIZING: Reading encrypted storage.
 * VALIDATING: Token found, verifying with backend authority.
 * AUTHENTICATED: Backend verified identity.
 * OFFLINE_AUTH: Token exists but backend unreachable; using cached identity.
 * UNAUTHENTICATED: No session or token rejected by backend.
 */
type AuthStatus =
  | 'INITIALIZING'
  | 'VALIDATING'
  | 'AUTHENTICATED'
  | 'OFFLINE_AUTH'
  | 'UNAUTHENTICATED';

interface IUser {
  _id: string;
  firebaseUid: string;
  imageUrl: string;
  email: string;
  role: string;
  tokenBalance: number;
  displayName: string;
  phoneNumber: string;
}

interface AuthState {
  user: IUser | null;
  token: string | null;
  status: AuthStatus;
  signIn: (token: string, user: IUser) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (partialUser: Partial<IUser>) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('INITIALIZING');

  /**
   * Clears session completely
   */
  const signOut = async () => {
    setStatus('UNAUTHENTICATED');
    setUser(null);
    setToken(null);
    setAuthHeader(null);
    await storage.clearAuth();
  };

  /**
   * Sets authenticated session
   */
  const signIn = async (newToken: string, userData: IUser) => {
    setAuthHeader(newToken);
    setToken(newToken);
    setUser(userData);
    setStatus('AUTHENTICATED');
    await storage.saveAuth(newToken, userData);
  };

  /**
   * Partial user update (profile edits, image upload, etc.)
   */
  const updateUser = async (partialUser: Partial<IUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partialUser } : prev));

    const { token, user } = await storage.getAuth();
    if (token && user) {
      await storage.saveAuth(token, { ...user, ...partialUser });
    }
  };

  useEffect(() => {
    /**
     * Listen for global 401s triggered by Axios interceptor
     */
    const handleUnauthorized = () => {
      signOut();
    };

    authEventEmitter.on('UNAUTHORIZED_ACCESS', handleUnauthorized);

    const initializeSession = async () => {
      try {
        const { token: cachedToken, user: cachedUser } =
          await storage.getAuth();

        if (!cachedToken || !cachedUser) {
          setStatus('UNAUTHENTICATED');
          return;
        }

        // Prepare API client
        setAuthHeader(cachedToken);
        setToken(cachedToken);
        setStatus('VALIDATING');

        // Authoritative backend validation
        const response = await api.get('/auth/me');

        if (response.data.success) {
          setUser(response.data.user);
          setStatus('AUTHENTICATED');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          // Token explicitly rejected
          await signOut();
        } else {
          // Network failure / offline mode
          const { token: cachedToken, user: cachedUser } =
            await storage.getAuth();

          if (cachedToken && cachedUser) {
            setToken(cachedToken);
            setUser(cachedUser);
            setStatus('OFFLINE_AUTH');
          } else {
            setStatus('UNAUTHENTICATED');
          }
        }
      }
    };

    initializeSession();

    return () => {
      authEventEmitter.off('UNAUTHORIZED_ACCESS', handleUnauthorized);
    };
  }, []);

  /**
   * Memoized context for performance on low-end devices
   */
  const contextValue = useMemo(
    () => ({
      user,
      token,
      status,
      signIn,
      signOut,
      updateUser,
    }),
    [user, token, status]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'SYSTEM_ERROR: useAuth must be used within an AuthProvider'
    );
  }
  return context;
};
