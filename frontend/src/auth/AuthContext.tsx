import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearAccessToken, errorMessage, setAccessToken } from '../lib/api';
import { setLogoutReason } from '../lib/idleReason';
import type { AppUser } from '../lib/types';

// Matches the backend's SESSION_IDLE_TIMEOUT_SECONDS default (see
// backend/src/modules/auth/auth.service.js#idleTimeoutSeconds). Kept in sync
// manually since the two run in different processes; if the backend default
// or env var ever changes, update this to match so the two mechanisms agree
// on what "idle" means. The frontend timer is the primary, accurate signal
// (real DOM interaction); the backend check is a backstop for when the tab
// never gets to run its own timer (sleep, crash, lost network).
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart'] as const;

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

  // Idle-suspend: sign the user out after IDLE_TIMEOUT_MS of no real
  // interaction. Only armed while authenticated, and torn down on logout /
  // unmount so it never fires against an anonymous session.
  useEffect(() => {
    if (status !== 'authed') return;

    let timer: ReturnType<typeof setTimeout>;
    const onIdle = () => {
      setLogoutReason('idle');
      void logout();
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [status, logout]);

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
