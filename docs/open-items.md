# Open Items

_Last updated: Month 3. PRD v2.1 + developer brief are reviewed (`docs/reference/`)._

## Resolved at Month 3 kickoff (approved decisions)

- **Lead status vocabulary on outcomes.** `leads.status` remains an OPEN/CLOSED operational
  flag: Sales → CLOSED + agent ownership released (converted customer leaves the calling
  queue; RM takes over); Not Interested → CLOSED; Callback and Not Answered leave it OPEN.
  Interest history is the call outcomes on the customer's calls — no invented status ladder.
- **RM on Sales.** Auto-assign the RM configured in `RELATIONSHIP_MANAGER_EMAIL` (seeded
  default `manager@grotec.local`) → `relationship_ownership` (one active per customer).
  Founder/Manager roster picker + authorised reassignment workflow land in Month 4.

## Resolved: Knowledge Base → AI Assistant (approved feature change, Sept 4)

- The planned Knowledge Base *screen* was replaced by a global AI-assisted chat widget
  (`assistant.use`/`assistant.manage`, `docs/permissions.md`). Its structured data
  (crop → problem → recommended Grotec product + usage) lives in `crop_product_guidance`
  and is used as retrieval context for the chat instead of a browsable table.
- This supersedes the earlier "no AI-assisted features" guardrail for the CRM scope, per the
  feature-change request. LLM provider stays behind an internal abstraction
  (`ASSISTANT_LLM_PROVIDER`) — no vendor is hard-coded; chat answers "assistant
  unavailable" gracefully when `LLM_API_KEY` is not configured.
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
6. ~~Call-state vocabulary~~ → Month 2 models canonical states
   (`DIALING/RINGING/CONNECTED/ENDED/NOT_ANSWERED/FAILED`) with providers mapping their own
   vocabulary onto them (PRD §6.3.3 open item handled without hard-coding).
7. ~~Auto-dialer integration approach~~ → internal `AutoDialerProvider` abstraction with a
   config-selected provider; mock adapter ships; vendor TBD (PRD §6.3.2). Status pushes via
   `POST /dialer/webhooks/:provider` (shared secret) or polling, both through the same seam.

## Still OPEN — requires GROTEC confirmation (do not guess)

1. **Lead-source taxonomy.** PRD references "source/lead info" but defines no source list;
   `leads.source` is free text. (Status vocabulary was resolved at the Month 3 kickoff —
   OPEN/CLOSED operational flag; see above.)
2. **Staff permission boundaries** (§5.1.4). Exact boundary is a PRD open item to be finalised
   during detailed design/UAT; staff currently has zero CRM permissions.
3. **Exact "Founder-restricted" boundary** (§5.1.2). Working assumption: employee deactivate +
   reset password, audit logs, founder-role assignment are founder-only.
4. **Customer preferred-language vocabulary.** Column reserved (`preferred_language`); no list
   defined. Needed before multi-language content/messaging.
5. **Crop master.** PRD defines crop *category* (field/tree/plantation, §6.5.1) but no canonical
   crop list or acreage-unit/locale rules. Seed catalog (15 crops) is provisional; category
   column arrives with the crop-product guidance content (AI Assistant) in Month 4.
6. **Farmer identity extras** from the brief (crop age/stage, farm profile). Not modelled yet;
   evaluate with the customer-profile build-out rather than speculatively.
7. **Calling-queue formation rules.** Not defined by the PRD; provisional = agent's open owned
   leads + dial-any-number (approved at Month 2 kickoff). Revisit with the Month 5 dashboard.
8. **One active call per agent.** Enforced (409) as a provisional working rule; not PRD-specified.
9. **Auto-dialer & messaging vendors/channels** are TBD (PRD §6.3.10, §12). Both abstractions
   ship with mock adapters (`DIALER_PROVIDER`, `MESSAGING_PROVIDER`); the real vendor adapters
   + webhook contracts (payload shape, auth scheme) are confirmed when vendors are selected.
   The automatic product-message **channel and template** are also OPEN — content currently
   composes from the customer's crops + `crop_product_guidance` with a generic Grotec fallback.
10. **Not Answered retry behaviour** — explicitly open; never auto-invent (PRD §6.3.9).
11. **RM as a distinct permissioned role** — deferred to Phase 2 (PRD §6.4, §18.4). RM is an
    ownership concept (existing MANAGER role holds RM ownership by default via
    `RELATIONSHIP_MANAGER_EMAIL`).
12. **Follow-up status vocabulary + scheduling timezone.** `PENDING/COMPLETED/CANCELLED` is
    provisional; due-at timezone interpretation is currently server-local. Confirm before
    multi-timezone rollout.

## Environment-driven deviations from the approved plan (approved at kickoff)

- **npm workspaces** instead of pnpm (pnpm unavailable in the build environment).
- **scrypt** password hashing instead of argon2 (no native toolchain required).
- Dev DB: **docker-compose (Postgres 16)** for normal machines; **embedded Postgres 18**
  (`npm run db:start`) as fallback where Docker is unavailable. Same schema both ways.
- UI primitives: hand-rolled shadcn-style components (same design language, no codegen CLI).
