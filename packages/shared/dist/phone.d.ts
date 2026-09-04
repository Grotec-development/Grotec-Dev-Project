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
/** True when the input is a plausible raw phone string (not yet normalized). */
export declare function isPlausiblePhoneInput(value: string): boolean;
/**
 * Normalize a raw phone input to canonical E.164 ("+CC…", no separators).
 * Returns null when the input cannot be normalized unambiguously.
 */
export declare function normalizePhoneToE164(value: string): string | null;
/** Structural validity check for a canonical stored value. */
export declare function isValidE164(value: string): boolean;
