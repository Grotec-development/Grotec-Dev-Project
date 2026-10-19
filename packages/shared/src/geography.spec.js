import { describe, expect, it } from 'vitest';
import { validateParentChildGeographic } from './geography';

describe('geographic parent-child validation', () => {
  it('accepts valid parent-child state -> district -> taluk', () => {
    const res = validateParentChildGeographic({
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      taluk: 'Pollachi',
    });
    expect(res.valid).toBe(true);
  });

  it('rejects invalid taluk for a given district', () => {
    // Pollachi is in Coimbatore, not Thanjavur
    const res = validateParentChildGeographic({
      state: 'Tamil Nadu',
      district: 'Thanjavur',
      taluk: 'Pollachi',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toBe('INVALID_TALUK_FOR_DISTRICT');
  });

  it('rejects invalid district for a given state', () => {
    // Coimbatore is in Tamil Nadu, not Kerala
    const res = validateParentChildGeographic({
      state: 'Kerala',
      district: 'Coimbatore',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toBe('INVALID_DISTRICT_FOR_STATE');
  });

  it('allows incomplete address without taluk or village', () => {
    const res = validateParentChildGeographic({
      state: 'Tamil Nadu',
      district: 'Dharmapuri',
      taluk: null,
    });
    expect(res.valid).toBe(true);
  });
});
