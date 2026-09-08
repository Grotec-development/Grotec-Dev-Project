import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
/**
 * scrypt password hashing. Format: scrypt$N$r$p$<saltB64>$<hashB64>
 * (Node built-in crypto — no native addon required.)
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
    return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt')
        return false;
    const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
    const n = Number.parseInt(nRaw, 10);
    const r = Number.parseInt(rRaw, 10);
    const p = Number.parseInt(pRaw, 10);
    if (!n || !r || !p)
        return false;
    try {
        const salt = Buffer.from(saltB64, 'base64');
        const expected = Buffer.from(hashB64, 'base64');
        const actual = await scrypt(password, salt, expected.length, { N: n, r, p });
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    }
    catch {
        return false;
    }
}
