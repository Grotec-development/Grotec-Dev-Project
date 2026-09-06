import { createHash, randomBytes } from 'node:crypto';

export const REFRESH_COOKIE = 'grotec_refresh';

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshCookieOptions(ttlDays: number, secure: boolean, sameSite: string) {
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite as 'lax' | 'strict' | 'none',
    path: '/api/v1/auth',
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
  };
}
