/**
 * Pure helpers for the inline farmer editor shared by the Farmers profile and
 * Agent Mode. Kept free of React and axios so the rules are directly testable.
 */

/** Longest soil type the backend stores — Customer.soilType is VARCHAR(40). */
export const SOIL_TYPE_MAX_LENGTH = 40;

export interface FarmerUpdatePayload {
  fullName: string;
  soilType: string | null;
}

/**
 * Body for PATCH /customers/:id. Both fields are trimmed; an empty soil type
 * becomes null, which the backend treats as "clear". Only the two fields that
 * endpoint supports are sent, so nothing else on the record is disturbed.
 */
export function buildFarmerUpdatePayload(fullName: string, soilType: string): FarmerUpdatePayload {
  return {
    fullName: fullName.trim(),
    soilType: soilType.trim() || null,
  };
}

/**
 * Agent Mode loads the farmer through detailForCallContext(), which deliberately
 * skips agent visibility scoping so any dialled number can show its match. So
 * holding customer.update is not enough to edit THIS record: a scoped read of it
 * (GET /customers/:id, the same check PATCH runs) must also have succeeded.
 */
export function canEditFarmerRecord(hasUpdatePermission: boolean, scopedReadSucceeded: boolean): boolean {
  return hasUpdatePermission && scopedReadSucceeded;
}

/** Location fields the compact editor exposes, in the order shown. */
export interface LocationDraft {
  village: string;
  taluk: string;
  district: string;
  state: string;
  pincode: string;
}

export const EMPTY_LOCATION_DRAFT: LocationDraft = {
  village: '',
  taluk: '',
  district: '',
  state: '',
  pincode: '',
};

/**
 * Draft for the customer's primary location (or the first on file). Also used to
 * restore the form on Cancel, so cancelling never issues a request.
 */
export function locationDraftFrom(
  locations: Array<{ village: string | null; taluk: string | null; district: string | null; state: string | null; pincode: string | null; isPrimary: boolean }> | undefined,
): LocationDraft {
  const loc = locations?.find((l) => l.isPrimary) ?? locations?.[0];
  if (!loc) return { ...EMPTY_LOCATION_DRAFT };
  return {
    village: loc.village ?? '',
    taluk: loc.taluk ?? '',
    district: loc.district ?? '',
    state: loc.state ?? '',
    pincode: loc.pincode ?? '',
  };
}

/**
 * Body for POST/PATCH /customers/:id/locations. Every field is trimmed; an empty
 * one is sent as null, which class-validator's @IsOptional() accepts and Prisma
 * stores as NULL — so clearing a field works the same way soil type does.
 */
export function buildLocationPayload(draft: LocationDraft): Record<keyof LocationDraft, string | null> {
  const clean = (v: string) => v.trim() || null;
  return {
    village: clean(draft.village),
    taluk: clean(draft.taluk),
    district: clean(draft.district),
    state: clean(draft.state),
    pincode: clean(draft.pincode),
  };
}

/**
 * Parses an acreage input against the backend contract: a number > 0 with at
 * most two decimal places (@IsNumber({maxDecimalPlaces: 2}) @Min(0.01)).
 * Returns null when the text cannot be sent, so the caller can refuse to save.
 */
export function parseAcreage(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0.01) return null;
  return parsed;
}

/**
 * Body for PATCH /customers/:id/crops/:customerCropId. The crop itself is not
 * changeable through that endpoint — only acreage, unit and notes — so only the
 * two fields the compact editor exposes are sent.
 */
export function buildCropPayload(acreage: number, unit: string): { acreage: number; unit?: string } {
  const trimmedUnit = unit.trim();
  return trimmedUnit ? { acreage, unit: trimmedUnit } : { acreage };
}

/**
 * Body for POST /customers/:id/phones. The backend normalises to E.164 and
 * rejects duplicates, so the raw input is passed through untouched but trimmed.
 */
export function buildAddPhonePayload(rawNumber: string, makePrimary: boolean): { number: string; isPrimary?: boolean } {
  const number = rawNumber.trim();
  return makePrimary ? { number, isPrimary: true } : { number };
}
