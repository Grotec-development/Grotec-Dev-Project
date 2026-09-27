"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISTRICT_ALIASES = void 0;
exports.canonicalDistrictKey = canonicalDistrictKey;
exports.districtSpellings = districtSpellings;
/**
 * District spelling aliases. Older records (and farmer imports) use colloquial
 * or pre-reorganisation names; the location master uses Local Government
 * Directory names. Keys and values are lower-case.
 */
exports.DISTRICT_ALIASES = {
    tiruvallur: 'thiruvallur',
    tiruvarur: 'thiruvarur',
    thoothukudi: 'thoothukkudi',
    tuticorin: 'thoothukkudi',
    trichy: 'tiruchirappalli',
    kanyakumari: 'kanniyakumari',
    nilgiris: 'the nilgiris',
    villupuram: 'viluppuram',
    anantapur: 'ananthapuramu',
    anantapuram: 'ananthapuramu',
    kadapa: 'y.s.r. kadapa',
    'ysr kadapa': 'y.s.r. kadapa',
    nellore: 'sri potti sriramulu nellore',
    'spsr nellore': 'sri potti sriramulu nellore',
    konaseema: 'dr. b.r. ambedkar konaseema',
    rangareddy: 'ranga reddy',
    jangaon: 'jangoan',
    'warangal urban': 'hanumakonda',
    'warangal rural': 'warangal',
};
/** Lower-case canonical form of a district name (alias-resolved). */
function canonicalDistrictKey(name) {
    const key = String(name ?? '').trim().toLowerCase();
    return exports.DISTRICT_ALIASES[key] ?? key;
}
/**
 * Every lower-case spelling that refers to the same district as `name`
 * (the canonical name plus all of its aliases). Use for case-insensitive
 * `in`/`equals` filters so old and new spellings match each other.
 */
function districtSpellings(name) {
    const canonical = canonicalDistrictKey(name);
    if (!canonical)
        return [];
    const aliases = Object.keys(exports.DISTRICT_ALIASES).filter((alias) => exports.DISTRICT_ALIASES[alias] === canonical);
    return [canonical, ...aliases];
}
