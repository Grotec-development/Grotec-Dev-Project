"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_COOKIE = void 0;
exports.generateRefreshToken = generateRefreshToken;
exports.hashRefreshToken = hashRefreshToken;
exports.refreshCookieOptions = refreshCookieOptions;
const node_crypto_1 = require("node:crypto");
exports.REFRESH_COOKIE = 'grotec_refresh';
function generateRefreshToken() {
    return (0, node_crypto_1.randomBytes)(48).toString('base64url');
}
function hashRefreshToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function refreshCookieOptions(ttlDays, secure, sameSite) {
    return {
        httpOnly: true,
        secure,
        sameSite: sameSite,
        path: '/api/v1/auth',
        maxAge: ttlDays * 24 * 60 * 60 * 1000,
    };
}
//# sourceMappingURL=session.util.js.map