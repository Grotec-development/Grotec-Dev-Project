/**
 * Phone normalization (Month 1 foundation).
 *
 * The CRM stores one canonical form per phone — E.164 with leading '+', e.g.
 * `+919876543210`. Duplicate prevention (docs/business-rules.md) compares these
 * canonical values, so +91/0/91/space/dash variants of one number all collide.
 *
 * India-first heuristics apply to bare national numbers; anything else must carry
 * an international prefix and is otherwise rejected (never guessed).
 */

const DIGITS_ONLY = /^\d+$/;

/** True when the input is a plausible raw phone string (not yet normalized). */
export function isPlausiblePhoneInput(value: string): boolean {
  const cleaned = stripSeparators(value);
  return DIGITS_ONLY.test(cleaned.replace(/^\+/, '')) && cleaned.replace(/^\+/, '').length >= 10 && cleaned.replace(/^\+/, '').length <= 15;
}

function stripSeparators(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

/**
 * Normalize a raw phone input to canonical E.164 ("+CC…", no separators).
 * Returns null when the input cannot be normalized unambiguously.
 */
export function normalizePhoneToE164(value: string): string | null {
  const cleaned = stripSeparators(value.trim());
  if (cleaned.length === 0) return null;

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    return DIGITS_ONLY.test(digits) && digits.length >= 10 && digits.length <= 15
      ? `+${digits}`
      : null;
  }
  if (!DIGITS_ONLY.test(cleaned) || cleaned.length < 10 || cleaned.length > 15) return null;

  // India-first national-number heuristics.
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `+91${cleaned.slice(1)}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith('091')) return `+91${cleaned.slice(3)}`;

  // Any other bare number is ambiguous (unknown country code) — require "+CC".
  return null;
}

/** Structural validity check for a canonical stored value. */
export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
