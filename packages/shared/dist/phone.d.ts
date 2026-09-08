/** True when the input is a plausible raw phone string (not yet normalized). */
export function isPlausiblePhoneInput(value: any): boolean;
/**
 * Normalize a raw phone input to canonical E.164 ("+CC…", no separators).
 * Returns null when the input cannot be normalized unambiguously.
 */
export function normalizePhoneToE164(value: any): string;
/** Structural validity check for a canonical stored value. */
export function isValidE164(value: any): boolean;
