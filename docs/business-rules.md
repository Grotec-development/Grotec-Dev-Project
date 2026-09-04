# Business Rules

_Last updated: Month 1. Rules marked ⚠ are provisional or pending PRD confirmation._

## Customer identity & phone numbers (Month 1)

- Every customer is created with a unique **Farmer ID** (`GF` + 8-digit sequence, e.g.
  `GF00000042`) per the developer-brief farmer-master list.
- Every customer phone is normalized to canonical E.164 at the API boundary (e.g.
  `9876543210` → `+919876543210`; leading `0` dropped and `+91` applied for 10-digit Indian
  numbers; 10–15 digit numbers accepted with/without `+`).
- **Duplicate prevention** (PRD §6.3.5: "every phone number maps to one customer record"):
  creating a customer with a phone already held by a live customer returns
  `409 CUSTOMER_PHONE_EXISTS` with the matched customer so the caller can attach the work to
  the existing customer instead. Enforced by DB partial unique index + API check.
  Confirmed by PRD — not an open item. Shared/duplicate phones are rejected; family-member
  sharing scenarios are not supported by the PRD's de-duplication goal.
- One phone per customer is `is_primary` (alternate numbers are additional non-primary rows,
  per the brief's "alternate number" field).
- Location hierarchy per PRD: village / **taluk** / district / state (+ pincode).
- `preferred_language` column reserved; vocabulary is an open item.

## Ownership (Month 1 groundwork)

- `lead_ownership` = agent's ownership of the prospect. A lead has exactly one **current**
  owner (partial unique index). History rows are append-only (`released_at`).
- Relationship ownership (RM, Month 4) is a separate concept and will never reuse this field.
- Assignment/reassignment rules beyond "manager can assign" are ⚠ open.

## Call outcomes (Month 3 — not implemented yet, rules fixed here for design)

- Exactly three outcomes: **Interested**, **Not Interested**, **Not Answered**.
- `callOutcome` and `nextAction` are always separate stored fields.
- Interested requires exactly ONE next action: **Callback** or **Sales** (no default; both
  rejected). Callback requires follow-up date/time/reason; Sales triggers RM handoff.
- No automatic retry policy — retries are ⚠ open business decision; if implemented later it
  must be configurable, never assumed.

## Identity

- One `employees` table shared with future HRMS. No separate CRM user identity.
