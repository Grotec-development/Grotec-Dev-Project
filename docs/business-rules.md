# Business Rules

_Last updated: Month 1. Rules marked ⚠ are provisional or pending PRD confirmation._

## Phone numbers (Month 1)

- Every customer phone is normalized to canonical E.164 at the API boundary (e.g.
  `9876543210` → `+919876543210`; leading `0` dropped and `+91` applied for 10-digit Indian
  numbers; 10–15 digit numbers accepted with/without `+`).
- **Duplicate prevention**: creating a customer with a phone already held by a live customer
  returns `409 CUSTOMER_PHONE_EXISTS` with the matched customer so the caller can attach the
  work to the existing customer instead. Enforced by DB partial unique index + API check.
  ⚠ PRD question: can two customers ever legitimately share a phone (family members)?
- One phone per customer is `is_primary`.

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
