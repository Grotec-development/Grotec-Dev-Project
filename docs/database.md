# Database

_Last updated: Month 3. PostgreSQL + Prisma. Migrations live in `apps/api/prisma/migrations`._

## Conventions

- UUID primary keys (`gen_random_uuid()`), `timestamptz` timestamps.
- Soft delete via nullable `deleted_at` on business records; queries filter `deleted_at IS NULL`.
- Ownership + audit rows are append-only history (never deleted).
- Foreign keys `RESTRICT` on delete of business references — no cascade destruction.
- Phone duplicate prevention = **partial unique index** `(phone_e164) WHERE deleted_at IS NULL`
  plus application-layer check returning a 409 with the matched customer.

## Month 1 entities

```
employees ──1:N──> auth_sessions
employees N:1 roles ──N:M role_permissions M:N permissions

customers ──1:N──> customer_phones
customers ──1:N──> customer_locations
customers ──1:N──> customer_crops ──N:1 crops
customers ──1:N──> leads ──1:N──> lead_ownership ──N:1 employees
customers ──1:N──> calls ──1:N──> call_notes ──N:1 employees
leads ──1:N──> calls (optional lead context)
calls ──1:N──> follow_ups ──N:1 employees (agent) — from Interested→Callback outcomes
customers ──1:N──> relationship_ownership ──N:1 employees (RM holder)
customers ──1:N──> outbound_messages (automatic product-detail sends)
audit_events (standalone, append-only)
```

| Table | Purpose | Key constraints |
|---|---|---|
| `employees` | Shared identity (HRMS will extend later) | unique `email` (lowercase); FK `role_id` |
| `roles` | FOUNDER / MANAGER / AGENT / STAFF | unique `code` |
| `permissions` | Fine-grained action codes | unique `code` |
| `role_permissions` | Role matrix (seed data) | PK (`role_id`,`permission_id`) |
| `auth_sessions` | Refresh-token store (hashed) | FK employee; `revoked_at` |
| `customers` | Farmer master | soft delete; `status`; **unique `farmer_code`** (Farmer ID `GF`+8 digits, from `farmer_code_seq`) |
| `customer_phones` | Farmer phone numbers | **partial unique `phone_e164`**; partial unique one primary per customer |
| `customer_locations` | Address (village/taluk/district/state/pincode) + optional geo | one primary |
| `crops` | Crop reference catalog | unique `code`; `is_active` |
| `customer_crops` | Farmer crop + acreage | partial unique (`customer_id`,`crop_id`) |
| `leads` | Sales opportunity for a customer | FK customer; status OPEN/CLOSED (provisional vocabulary) |
| `lead_ownership` | Agent ownership history | **partial unique (`lead_id`) WHERE `released_at IS NULL`** → exactly one current owner |
| `calls` | One row per outbound auto-dial call | unique `provider_call_id`; FK agent (RESTRICT); FK customer/lead **SET NULL**; indexes (agent,started_at), (customer,started_at), phone, status; Month 3 adds nullable `outcome` + `next_action` (separate columns) |
| `call_notes` | Agent notes on a call | FK call (CASCADE); FK author (RESTRICT); index call_id |
| `follow_ups` | Callback schedule from an Interested outcome (Month 3) | FK customer (RESTRICT); FK call (RESTRICT); FK agent (RESTRICT); status `PENDING/COMPLETED/CANCELLED` ⚠ provisional; indexes (agent,due_at), (customer,due_at), status |
| `relationship_ownership` | RM ownership history (Month 3 activation on Sales; Month 4 workspace) | FK customer; FK employee (RM holder) + assigned_by; **partial unique (`customer_id`) WHERE `released_at IS NULL`** → one active RM; append-only history |
| `outbound_messages` | Automatic product-communication records (Month 3, PRD §6.3.10) | FK customer; FK call (SET NULL); type `PRODUCT_DETAILS`; provider + status `PENDING/SENT/FAILED`; attempts, error; real channel/template ⚠ OPEN (mock provider only) |
| `audit_events` | Append-only audit | indexes on entity, actor, time |

## Month 2 details

- `calls` keeps the **normalized dialed number** independent of the customer so a call can
  exist (and continue) while the customer record is created mid-call (PRD §6.3.5). The call
  links to the customer immediately on creation (`customers` creation backfills in-flight
  calls dialed to those numbers) and at terminal status via phone resolution.
- `calls.status` uses the canonical `CallStatus` enum
  (`DIALING/RINGING/CONNECTED/ENDED/NOT_ANSWERED/FAILED`). The PRD marks the final state list
  provider-dependent (§6.3.3, open item) — providers map their vocabulary onto these canonical
  states; nothing is hard-coded into business logic.
- `calls.provider` + `provider_call_id` are the integration seam; a future vendor adapter
  reuses the same rows (webhooks arrive at `POST /dialer/webhooks/:provider`).
- Outcome/next-action columns arrive with Month 3 (migration `20260904150000_outcomes`):
  `calls.outcome` (`CallOutcome`: INTERESTED/NOT_INTERESTED/NOT_ANSWERED) and
  `calls.next_action` (`NextAction`: CALLBACK/SALES) are **two separate nullable columns**;
  `follow_ups`, `relationship_ownership` and `outbound_messages` tables; the new
  `FollowUpStatus`/`MessageStatus` enums. Uniqueness for one active RM per customer and one
  current lead owner per lead both use partial unique indexes on non-released rows.

## Deferred to later months (designed, not created)

- Month 4: relationship-manager workspace features on `relationship_ownership` (release /
  authorised reassignment workflow, My Customers), customer-level notes if confirmed.
- Real messaging/dialer vendor adapters once vendors are selected (⚠ OPEN).
- `crop_product_guidance` (created with the AI Assistant) gains a crop **category** column
  when the PRD crop taxonomy is confirmed.

## Notes

- Enum-like fields (employee/customer status, phone kind) use PostgreSQL enums mirrored in
  `packages/shared`.
- Acreage is `numeric(12,2)`; units column (`acre` default) — unit/locale handling is an open item.
- Location hierarchy uses **taluk** (PRD glossary) — `customer_locations.taluk`.
- `20260904120000_prd_alignment` renamed tehsil→taluk, added `farmer_code` (sequence + backfill)
  and reserved `preferred_language`. Prisma `migrate dev` refuses non-TTY environments, so new
  migrations are authored as SQL and applied with `prisma migrate deploy`.
- Migration `20260904150000_outcomes` (Month 3): outcome/next-action columns + `follow_ups` +
  `relationship_ownership` + `outbound_messages` + enums.
- Full-text/trigram search on customer name can be added later via raw-SQL migration if needed.
