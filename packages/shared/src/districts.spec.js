import { describe, expect, it } from 'vitest';
import { canonicalDistrictKey, districtSpellings } from './districts';

describe('district aliases', () => {
  it('resolves old spellings to the canonical district', () => {
    expect(canonicalDistrictKey(' Tiruvallur ')).toBe('thiruvallur');
    expect(canonicalDistrictKey('Salem')).toBe('salem');
    expect(canonicalDistrictKey(undefined)).toBe('');
  });

  it('lists every spelling of a district from either spelling', () => {
    expect(districtSpellings('Thoothukkudi').sort()).toEqual(['thoothukkudi', 'thoothukudi', 'tuticorin']);
    expect(districtSpellings('Tuticorin').sort()).toEqual(['thoothukkudi', 'thoothukudi', 'tuticorin']);
    expect(districtSpellings('Salem')).toEqual(['salem']);
    expect(districtSpellings('')).toEqual([]);
  });
});
