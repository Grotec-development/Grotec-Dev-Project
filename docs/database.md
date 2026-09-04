# Database

_Last updated: Month 1. PostgreSQL + Prisma. Migrations live in `apps/api/prisma/migrations`._

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
| `audit_events` | Append-only audit | indexes on entity, actor, time |

## Deferred to later months (designed, not created)

- Month 2: `calls`, `call_notes` (+ auto-dialer integration state).
- Month 3: `follow_ups`, call outcome handling (exactly Interested / Not Interested /
  Not Answered; outcome and next action stored as separate fields).
- Month 4: `relationship_ownership`, knowledge base (`problems`, `solutions`, `kb_entries`).
- `messages` when a MessagingProvider is integrated.

## Notes

- Enum-like fields (employee/customer status, phone kind) use PostgreSQL enums mirrored in
  `packages/shared`.
- Acreage is `numeric(12,2)`; units column (`acre` default) — unit/locale handling is an open item.
- Location hierarchy uses **taluk** (PRD glossary) — `customer_locations.taluk`.
- `20260904120000_prd_alignment` renamed tehsil→taluk, added `farmer_code` (sequence + backfill)
  and reserved `preferred_language`. Prisma `migrate dev` refuses non-TTY environments, so new
  migrations are authored as SQL and applied with `prisma migrate deploy`.
- Full-text/trigram search on customer name can be added later via raw-SQL migration if needed.
