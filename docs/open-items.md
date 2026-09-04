# Open Items

_Last updated: Month 1. PRD v2.1 + developer brief are reviewed (`docs/reference/`)._
_Resolved items carry PRD references; everything still OPEN must be confirmed by GROTEC._

## Resolved during PRD review

1. ~~Permission matrix~~ → PRD §5.2 implemented in `docs/permissions.md` and seed data
   (Staff = no CRM access; audit logs Founder-only; agent = assigned-only scope).
2. ~~Customer identity fields~~ → unique Farmer ID (`GF` + seq), name, mobile/alternate
   phones, village / taluk / district / state / pincode (PRD §6.3.4, brief master list).
3. ~~Duplicate definition~~ → one phone number maps to one customer record; duplicates
   actively reduced (PRD §6.3.5); enforced at DB + API (409 + matched customer).
4. ~~Location hierarchy~~ → village / taluk / district / state (PRD §6.3.4, glossary "Taluk").
5. Shared employee identity for CRM + HRMS (PRD §11 invariants) — implemented.

## Still OPEN — requires GROTEC confirmation (do not guess)

1. **Lead-source taxonomy & lead status vocabulary.** PRD references "source/lead info" on the
   customer and "interest status" but does not define the source list or the status values that
   map onto Month 3 outcomes. Currently: `leads.source` is free text; `LeadStatus` = OPEN/CLOSED
   provisional. Must be reconciled before Month 3.
2. **Staff permission boundaries** (§5.1.4). Exact boundary is a PRD open item to be finalised
   during detailed design/UAT; staff currently has zero CRM permissions.
3. **Exact "Founder-restricted" boundary** (§5.1.2). Working assumption: employee deactivate +
   reset password, audit logs, founder-role assignment are founder-only.
4. **Customer preferred-language vocabulary.** Column reserved (`preferred_language`); no list
   defined. Needed before multi-language content/messaging.
5. **Crop master.** PRD defines crop *category* (field/tree/plantation, §6.5.1) but no canonical
   crop list or acreage-unit/locale rules. Seed catalog (15 crops) is provisional; category
   column arrives with the Knowledge Base in Month 4.
6. **Farmer identity extras** from the brief (crop age/stage, farm profile). Not modelled yet;
   evaluate with the customer-profile build-out in Month 2/4 rather than speculatively.
7. **Call-state vocabulary** is provider-dependent and open until the dialer vendor is selected
   (PRD §6.3.3) — Month 2 must model it configurable.
8. **Auto-dialer & messaging vendors/channels** are TBD (PRD §6.3.10, §12); integrations sit
   behind internal abstractions (Month 2/3).
9. **Not Answered retry behaviour** — explicitly open; never auto-invent (PRD §6.3.9).
10. **RM as a distinct permissioned role** — deferred to Phase 2 (PRD §6.4, §18.4).

## Environment-driven deviations from the approved plan (approved at kickoff)

- **npm workspaces** instead of pnpm (pnpm unavailable in the build environment).
- **scrypt** password hashing instead of argon2 (no native toolchain required).
- Dev DB: **docker-compose (Postgres 16)** for normal machines; **embedded Postgres 18**
  (`npm run db:start`) as fallback where Docker is unavailable. Same schema both ways.
- UI primitives: hand-rolled shadcn-style components (same design language, no codegen CLI).
