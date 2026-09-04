# Business Rules

_Last updated: Month 3. Rules marked ⚠ are provisional or pending PRD confirmation._

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

## Calling workspace (Month 2)

- **Auto-dial only** (PRD §6.3.2): the agent never types a number into a vendor dialer — the
  CRM places the call through the configured provider via `POST /calls`. Vendor sits behind
  `AutoDialerProvider`; provider selection is config (`DIALER_PROVIDER`), never hard-coded.
- **Phone resolution on dial** (PRD §6.3.5): the dialed number resolves to the existing
  customer master; otherwise the call starts unresolved and the agent can create the customer
  **during** the call. Creating the customer links the in-flight call immediately (context
  appears mid-call) and never ends the call. Calls keep the dialed number so a call can
  outlive a not-yet-created customer.
- **One active call per agent** ⚠ (not PRD-specified): a second `POST /calls` returns
  `409 ACTIVE_CALL_EXISTS` with the existing call id. Reversible if pooling is later desired.
- **Call state** (PRD §6.3.3): canonical states `DIALING → RINGING → CONNECTED → ENDED`
  (`NOT_ANSWERED`, `FAILED` as terminal alternatives). The final list is provider-dependent
  (open item) — canonical states are what providers map onto.
- **Status synchronisation**: `GET /calls/:id` reconciles with the provider; a background
  poller (`DIALER_SYNC_MS`) keeps in-flight calls current; vendor pushes arrive at
  `POST /dialer/webhooks/:provider` (shared-secret). A call the provider no longer knows is
  marked `FAILED/UNKNOWN` (covers server restarts).
- **Calling queue** ⚠ (PRD §6.2 scopes dashboard to own workload; queue formation rules are
  not defined): queue = the agent's open owned leads (+ phone search to dial anyone).
  Managers/founders see all with an `ownerId` filter. Approved at Month 2 kickoff.
- Month 2 records the call itself; outcomes arrive in Month 3 (below).

## Ownership (Month 1 groundwork)

- `lead_ownership` = agent's ownership of the prospect. A lead has exactly one **current**
  owner (partial unique index). History rows are append-only (`released_at`).
- Relationship ownership (RM, activated in Month 3 on Sales, full workspace Month 4) is a
  separate concept — never the same field.
  - On a **Sales** outcome the CRM auto-assigns the configured RM (env
    `RELATIONSHIP_MANAGER_EMAIL`) and records `relationship_ownership` (one active RM per
    customer, partial unique index) with reason/assigned_by/assigned_at. Release + authorised
    reassignment workflow is Month 4 (reassignment rules remain ⚠ open where the PRD is
    silent).
- Assignment/reassignment rules beyond "manager can assign" are ⚠ open.

## Call outcomes (Month 3 — implemented, PRD §6.3.6–6.3.9)

- Exactly three outcomes: **Interested**, **Not Interested**, **Not Answered**. Nothing else
  (busy / wrong number / call later / converted / callback are never outcomes).
- `calls.outcome` and `calls.next_action` are **separate stored columns** — never one combined
  status (PRD §11.1).
- **Interested** requires exactly ONE next action — **Callback** or **Sales**; no default;
  both-at-once rejected; Interested with no next action rejected.
- **Callback**: follow-up date + time + reason/note are required; creates a `follow_ups` row
  (`PENDING`).
- **Sales**: lead closes (`CLOSED`) and the agent's lead ownership is released — the converted
  customer exits the calling queue; `relationship_ownership` is created (RM = env
  `RELATIONSHIP_MANAGER_EMAIL`, seeded default `manager@grotec.local`) with one active RM per
  customer (partial unique index); an automatic product-details `outbound_messages` row is
  enqueued through the messaging provider (see below). Interest history lives on the call
  outcomes themselves. (Progression vocabulary approved at Month 3 kickoff: `lead.status` stays
  an OPEN/CLOSED operational flag.)
- **Not Interested**: outcome + call/customer history stored; Callback/Sales never shown or
  accepted. **Not Answered**: outcome + attempt history stored.
- **Not Answered retries** are an ⚠ open business decision — no automatic retry policy is
  invented or assumed; any future retry support must be configurable.
- One outcome per call; recording requires a terminal call state (ENDED / NOT_ANSWERED).

## Follow-ups (Month 3)

- `follow_ups.due_at` stores date + time combined; `note` holds the reason.
- Only `PENDING` follow-ups can be completed (→ `COMPLETED` + `completed_at`); status
  vocabulary (`PENDING/COMPLETED/CANCELLED`) is ⚠ provisional. Scheduling timezone is ⚠ open
  (currently server-local interpretation of the date/time inputs).
- Agents see and complete the callbacks they scheduled; Manager/Founder see all with
  `ownerId`/`status`/`customerId` filters.

## Messaging / automatic product communication (Month 3, PRD §6.3.10)

- The **channel, template and provider are ⚠ OPEN** — no real send happens yet. An internal
  `MessagingProvider` abstraction + config-selected mock adapter (`MESSAGING_PROVIDER=mock`)
  exists so nothing in CRM logic references a vendor.
- On Sales, an `outbound_messages` row (type `PRODUCT_DETAILS`) is created and sent through the
  mock provider; the body is composed from the customer's crops + `crop_product_guidance`
  retrieval, falling back to a generic Grotec intro. Failures are stored (`FAILED` + error),
  never silent, and surfaced on the customer context.

## Identity

- One `employees` table shared with future HRMS. No separate CRM user identity.
