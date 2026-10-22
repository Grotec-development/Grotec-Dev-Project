import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PROPOSED_ROLE_PERMISSIONS } from '@grotec/shared';
import { api, clearAccessToken, clearTenantId, errorMessage, getAccessToken, setAccessToken, setTenantId } from '../lib/api';
import { setLogoutReason } from '../lib/idleReason';
import type { AppUser } from '../lib/types';

// Inactivity timeout: 45 minutes of no user interaction.
const IDLE_TIMEOUT_MS = 45 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart', 'scroll', 'click'] as const;

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

function sanitizeUser(raw: unknown): AppUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Partial<AppUser>;
  const roleCode = u.roleCode ?? ('AGENT' as AppUser['roleCode']);
  const defaultRolePerms = ((PROPOSED_ROLE_PERMISSIONS as Record<string, string[]>)[roleCode] ?? []) as AppUser['permissions'];
  const permissions = Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : defaultRolePerms;

  return {
    id: u.id ?? '',
    email: u.email ?? '',
    fullName: u.fullName ?? '',
    roleCode,
    permissions,
    tenantId: u.tenantId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) {
          setStatus('anon');
        }
        return;
      }

      try {
        const res = await api.get<AppUser>('/auth/me');
        if (!cancelled) {
          const sanitized = sanitizeUser(res.data);
          if (sanitized?.tenantId) {
            setTenantId(sanitized.tenantId);
          }
          setUser(sanitized);
          setStatus('authed');
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          clearTenantId();
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
    const trimmed = email.trim();
    const res = await api.post<LoginResult>('/auth/login', {
      email: trimmed,
      identifier: trimmed,
      password,
    });
    setAccessToken(res.data.accessToken);
    const sanitized = sanitizeUser(res.data.employee);
    const tenantId = sanitized?.tenantId || (res.data as any)?.tenantId;
    if (tenantId) {
      setTenantId(tenantId);
    }
    setUser(sanitized);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // best effort — session cookie may already be gone
    }
    clearAccessToken();
    clearTenantId();
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
    (permission: string) =>
      Array.isArray(user?.permissions)
        ? user.permissions.includes(permission as AppUser['permissions'][number])
        : false,
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
