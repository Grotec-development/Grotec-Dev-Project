import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearAccessToken, errorMessage, setAccessToken } from '../lib/api';
import type { AppUser } from '../lib/types';

export type AuthStatus = 'loading' | 'anon' | 'authed';

interface LoginResult {
  accessToken: string;
  employee: AppUser;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await api.get<AppUser>('/auth/me');
        if (!cancelled) {
          setUser(res.data);
          setStatus('authed');
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setStatus('anon');
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResult>('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.employee);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // best effort — session cookie may already be gone
    }
    clearAccessToken();
    setUser(null);
    setStatus('anon');
  }, []);

  const hasPermission = useCallback(
    (permission: string) => (user ? user.permissions.includes(permission as AppUser['permissions'][number]) : false),
    [user],
  );

  const value = useMemo(
    () => ({ status, user, login, logout, hasPermission }),
    [status, user, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function authErrorMessage(error: unknown): string {
  return errorMessage(error);
}
