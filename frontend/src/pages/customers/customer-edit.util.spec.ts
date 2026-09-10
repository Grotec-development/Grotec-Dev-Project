import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOCATION_DRAFT,
  SOIL_TYPE_MAX_LENGTH,
  buildAddPhonePayload,
  buildCropPayload,
  buildFarmerUpdatePayload,
  buildLocationPayload,
  canEditFarmerRecord,
  locationDraftFrom,
  parseAcreage,
} from './customer-edit.util';

describe('buildFarmerUpdatePayload', () => {
  it('trims the farmer name', () => {
    expect(buildFarmerUpdatePayload('  Ramesh Patel  ', 'Red loam').fullName).toBe('Ramesh Patel');
  });

  it('trims the soil type', () => {
    expect(buildFarmerUpdatePayload('Ramesh', '  Black cotton  ').soilType).toBe('Black cotton');
  });

  it('sends null for an empty soil type so the backend clears it', () => {
    expect(buildFarmerUpdatePayload('Ramesh', '').soilType).toBe(null);
  });

  it('sends null for a whitespace-only soil type', () => {
    expect(buildFarmerUpdatePayload('Ramesh', '   ').soilType).toBe(null);
  });

  it('sends only the two fields PATCH /customers/:id supports', () => {
    expect(Object.keys(buildFarmerUpdatePayload('Ramesh', 'Red loam')).sort()).toEqual(['fullName', 'soilType']);
  });

  it('pins the soil type limit to the VARCHAR(40) column', () => {
    expect(SOIL_TYPE_MAX_LENGTH).toBe(40);
  });
});

describe('canEditFarmerRecord', () => {
  it('allows editing when the actor holds the permission and the scoped read succeeded', () => {
    expect(canEditFarmerRecord(true, true)).toBe(true);
  });

  it('refuses when the record is out of the actor scope, despite the permission', () => {
    expect(canEditFarmerRecord(true, false)).toBe(false);
  });

  it('refuses when the actor lacks customer.update', () => {
    expect(canEditFarmerRecord(false, true)).toBe(false);
  });

  it('refuses when neither holds', () => {
    expect(canEditFarmerRecord(false, false)).toBe(false);
  });
});

describe('locationDraftFrom', () => {
  const loc = (over: Record<string, unknown> = {}) => ({
    village: 'Thottiyam', taluk: 'Musiri', district: 'Trichy', state: 'Tamil Nadu', pincode: '621215', isPrimary: false, ...over,
  });

  it('prefers the primary location over the first on file', () => {
    const draft = locationDraftFrom([loc({ village: 'Secondary' }), loc({ village: 'Main', isPrimary: true })]);
    expect(draft.village).toBe('Main');
  });

  it('falls back to the first location when none is primary', () => {
    expect(locationDraftFrom([loc({ village: 'Only' })]).village).toBe('Only');
  });

  it('returns empty strings when the farmer has no location', () => {
    expect(locationDraftFrom([])).toEqual(EMPTY_LOCATION_DRAFT);
    expect(locationDraftFrom(undefined)).toEqual(EMPTY_LOCATION_DRAFT);
  });

  it('maps nulls to empty strings so the inputs stay controlled', () => {
    const draft = locationDraftFrom([loc({ taluk: null, pincode: null, isPrimary: true })]);
    expect(draft.taluk).toBe('');
    expect(draft.pincode).toBe('');
  });
});

describe('buildLocationPayload', () => {
  it('trims every field', () => {
    const payload = buildLocationPayload({ village: '  Thottiyam ', taluk: ' Musiri', district: 'Trichy ', state: ' TN ', pincode: ' 621215 ' });
    expect(payload).toEqual({ village: 'Thottiyam', taluk: 'Musiri', district: 'Trichy', state: 'TN', pincode: '621215' });
  });

  it('sends null for blank fields so the backend clears them', () => {
    const payload = buildLocationPayload({ village: 'Thottiyam', taluk: '', district: '   ', state: '', pincode: '' });
    expect(payload.taluk).toBe(null);
    expect(payload.district).toBe(null);
    expect(payload.state).toBe(null);
  });

  it('sends only the five location fields the editor exposes', () => {
    expect(Object.keys(buildLocationPayload(EMPTY_LOCATION_DRAFT)).sort()).toEqual(
      ['district', 'pincode', 'state', 'taluk', 'village'],
    );
  });
});

describe('parseAcreage', () => {
  it('accepts whole numbers and up to two decimals', () => {
    expect(parseAcreage('3')).toBe(3);
    expect(parseAcreage('3.5')).toBe(3.5);
    expect(parseAcreage(' 2.75 ')).toBe(2.75);
  });

  it('rejects more than two decimal places, matching @IsNumber({maxDecimalPlaces: 2})', () => {
    expect(parseAcreage('3.456')).toBe(null);
  });

  it('rejects values below the @Min(0.01) floor', () => {
    expect(parseAcreage('0')).toBe(null);
    expect(parseAcreage('0.00')).toBe(null);
  });

  it('rejects blank and non-numeric input', () => {
    expect(parseAcreage('')).toBe(null);
    expect(parseAcreage('   ')).toBe(null);
    expect(parseAcreage('two acres')).toBe(null);
    expect(parseAcreage('-2')).toBe(null);
  });
});

describe('buildCropPayload', () => {
  it('sends the acreage with a trimmed unit', () => {
    expect(buildCropPayload(3.5, '  acres ')).toEqual({ acreage: 3.5, unit: 'acres' });
  });

  it('omits the unit when blank rather than clearing it', () => {
    expect(buildCropPayload(3.5, '   ')).toEqual({ acreage: 3.5 });
  });

  it('never sends the crop association, which PATCH crops/:id cannot change', () => {
    expect(Object.keys(buildCropPayload(1, 'acres'))).not.toContain('cropId');
  });
});

describe('buildAddPhonePayload', () => {
  it('trims the number', () => {
    expect(buildAddPhonePayload('  9876543210 ', false)).toEqual({ number: '9876543210' });
  });

  it('flags the number as primary only when asked', () => {
    expect(buildAddPhonePayload('9876543210', true)).toEqual({ number: '9876543210', isPrimary: true });
  });
});
