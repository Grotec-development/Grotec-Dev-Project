import { createHash, randomBytes } from 'node:crypto';
export const REFRESH_COOKIE = 'grotec_refresh';
export function generateRefreshToken() {
    return randomBytes(48).toString('base64url');
}
export function hashRefreshToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
export function refreshCookieOptions(ttlDays, secure, sameSite) {
    return {
        httpOnly: true,
        secure,
        sameSite: sameSite,
        path: '/api/v1/auth',
        maxAge: ttlDays * 24 * 60 * 60 * 1000,
    };
}
