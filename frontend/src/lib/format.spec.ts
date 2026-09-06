import { describe, expect, it } from 'vitest';
import { formatE164, initialsOf } from './format';

describe('formatE164', () => {
  it('formats Indian mobile numbers for display', () => {
    expect(formatE164('+919876543210')).toBe('+91 98765 43210');
  });
  it('leaves other numbers untouched', () => {
    expect(formatE164('+14155552671')).toBe('+14155552671');
  });
});

describe('initialsOf', () => {
  it('takes up to two initials', () => {
    expect(initialsOf('Ramesh Patel')).toBe('RP');
    expect(initialsOf('Mohan')).toBe('M');
  });
});
