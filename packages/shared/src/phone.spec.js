import { describe, expect, it } from 'vitest';
import { isPlausiblePhoneInput, isValidE164, normalizePhoneToE164 } from './phone';

describe('normalizePhoneToE164', () => {
  it('normalizes a bare 10-digit Indian mobile number', () => {
    expect(normalizePhoneToE164('9876543210')).toBe('+919876543210');
  });

  it('normalizes leading-zero national numbers', () => {
    expect(normalizePhoneToE164('09876543210')).toBe('+919876543210');
  });

  it('normalizes a 91-prefixed national number with and without +', () => {
    expect(normalizePhoneToE164('919876543210')).toBe('+919876543210');
    expect(normalizePhoneToE164('+919876543210')).toBe('+919876543210');
  });

  it('normalizes 0-91-prefixed numbers', () => {
    expect(normalizePhoneToE164('0919876543210')).toBe('+919876543210');
  });

  it('strips spaces, dashes, parentheses and dots', () => {
    expect(normalizePhoneToE164('+91 98765-43210')).toBe('+919876543210');
    // India-first rule: a 10-digit bare number is treated as an Indian mobile
    // regardless of formatting, so separators-only variants normalize the same.
    expect(normalizePhoneToE164('(987) 654-3210')).toBe('+919876543210');
  });

  it('keeps a valid explicit international number', () => {
    expect(normalizePhoneToE164('+14155552671')).toBe('+14155552671');
  });

  it('rejects garbage', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('abc')).toBeNull();
    expect(normalizePhoneToE164('123')).toBeNull();
    expect(normalizePhoneToE164('123456789012345678')).toBeNull();
    expect(normalizePhoneToE164('++919876543210')).toBeNull();
  });

  it('never guesses country codes for ambiguous bare numbers', () => {
    // 11 digits not starting with 0 are not a valid national pattern — reject.
    expect(normalizePhoneToE164('19876543210')).toBeNull();
  });
});

describe('isPlausiblePhoneInput / isValidE164', () => {
  it('accepts plausible raw input', () => {
    expect(isPlausiblePhoneInput('9876543210')).toBe(true);
    expect(isPlausiblePhoneInput('+91 98765 43210')).toBe(true);
  });

  it('rejects implausible raw input', () => {
    expect(isPlausiblePhoneInput('abc')).toBe(false);
    expect(isPlausiblePhoneInput('12345')).toBe(false);
  });

  it('validates canonical E.164 values', () => {
    expect(isValidE164('+919876543210')).toBe(true);
    expect(isValidE164('919876543210')).toBe(false);
    expect(isValidE164('+1234')).toBe(false);
  });
});
