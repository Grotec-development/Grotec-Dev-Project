# Open Items

_Last updated: Month 1. Anything marked OPEN must be confirmed before it is treated as final._

## PRD review (blocking for finalization)

1. **PRD v2.1 + Developer Requirement Brief are not yet in the repo.** Upload to
   `docs/reference/`. Until reviewed: permission matrix, customer identity fields, lead
   taxonomy, and seed reference data are provisional.

## Needs PRD / business confirmation

2. Permission matrix per role per area (customers, leads, employees, audit, crops).
3. Farmer/customer identity fields beyond name + phone (gender, DOB, KYC, category, farmer code/URN?).
4. Duplicate definition: hard stop on normalized phone only, or also name+location matching?
   May two customers share a phone (family)?
5. Lead-source taxonomy and lead status vocabulary (must map onto Month 3 outcome flow).
6. Crop catalog: canonical crops + local names; acreage units (acre default) and seasons.
7. Customer location fields — India-only (state/district/tehsil/village/pincode) or multi-country?
8. Password policy / lockout / MFA expectations.
9. Which employee identity fields must exist now for future HRMS compatibility (kept minimal).
10. Audit retention expectations.

## Environment-driven deviations from the approved plan (approved at kickoff)

- **npm workspaces** instead of pnpm (pnpm not available in the build environment).
- **scrypt** password hashing instead of argon2 (no native toolchain required).
- Dev DB: **docker-compose (Postgres 16)** for normal machines; **embedded Postgres 18**
  (`npm run db:start`) as fallback where Docker is unavailable. Same schema both ways.
- UI primitives: hand-rolled shadcn-style components (same design language, no codegen CLI).
