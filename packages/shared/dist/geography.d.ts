/**
 * Validates a parent-child combination of geographic fields.
 * Rules:
 * - Empty fields are permitted (incomplete imported addresses are not rejected).
 * - If state is provided, it must be recognized if strict validation is desired.
 * - If district is provided with a valid state, district must belong to that state.
 * - If taluk is provided with a district, taluk must belong to that district.
 *
 * @param {{ state?: string | null, district?: string | null, taluk?: string | null }} loc
 * @returns {{ valid: boolean, error?: string, message?: string }}
 */
export function validateParentChildGeographic(loc: {
    state?: string | null;
    district?: string | null;
    taluk?: string | null;
}): {
    valid: boolean;
    error?: string;
    message?: string;
};
export const VALID_STATES: string[];
export const DISTRICTS_BY_STATE: {
    'Tamil Nadu': string[];
    'Andhra Pradesh': string[];
    Telangana: string[];
    Karnataka: string[];
    Kerala: string[];
};
/**
 * Keyed by canonical lower-case district key -> array of taluks.
 */
export const TALUKS_BY_DISTRICT: {
    coimbatore: string[];
    tiruppur: string[];
    dharmapuri: string[];
    salem: string[];
    erode: string[];
    namakkal: string[];
    krishnagiri: string[];
    dindigul: string[];
    madurai: string[];
    theni: string[];
    thanjavur: string[];
    tiruchirappalli: string[];
    thiruvarur: string[];
    nagapattinam: string[];
    mayiladuthurai: string[];
    cuddalore: string[];
    ariyalur: string[];
    perambalur: string[];
    pudukkottai: string[];
    sivaganga: string[];
    virudhunagar: string[];
    ramanathapuram: string[];
    tirunelveli: string[];
    tenkasi: string[];
    thoothukkudi: string[];
    kanniyakumari: string[];
    vellore: string[];
    ranipet: string[];
    tirupathur: string[];
    tiruvannamalai: string[];
    kanchipuram: string[];
    chengalpattu: string[];
    thiruvallur: string[];
    chennai: string[];
    viluppuram: string[];
    kallakurichi: string[];
    'the nilgiris': string[];
};
