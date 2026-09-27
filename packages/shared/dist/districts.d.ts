/** Lower-case canonical form of a district name (alias-resolved). */
export function canonicalDistrictKey(name: any): any;
/**
 * Every lower-case spelling that refers to the same district as `name`
 * (the canonical name plus all of its aliases). Use for case-insensitive
 * `in`/`equals` filters so old and new spellings match each other.
 */
export function districtSpellings(name: any): any[];
/**
 * District spelling aliases. Older records (and farmer imports) use colloquial
 * or pre-reorganisation names; the location master uses Local Government
 * Directory names. Keys and values are lower-case.
 */
export const DISTRICT_ALIASES: {
    tiruvallur: string;
    tiruvarur: string;
    thoothukudi: string;
    tuticorin: string;
    trichy: string;
    kanyakumari: string;
    nilgiris: string;
    villupuram: string;
    anantapur: string;
    anantapuram: string;
    kadapa: string;
    'ysr kadapa': string;
    nellore: string;
    'spsr nellore': string;
    konaseema: string;
    rangareddy: string;
    jangaon: string;
    'warangal urban': string;
    'warangal rural': string;
};
