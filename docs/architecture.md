# Architecture

_Last updated: Month 1 (CRM Foundation) — provisional until PRD review._

## System context

GROTEC FarmerOS CRM is a 5-month incremental build (see `development-progress.md`).
Month 1 delivers the foundation: shared employee identity, RBAC, customer/farmer master with
phone duplicate prevention, crops/acreage, leads + lead ownership, audit, REST API, responsive UI.

Future GROTEC modules (HRMS, inventory, sales transactions, etc.) must **extend** this system,
not duplicate its identity, ownership, history, or audit infrastructure.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Languages | TypeScript (strict) everywhere | shared types/constants via `packages/shared` |
| Monorepo | npm workspaces | `apps/api`, `apps/web`, `packages/shared` |
| Database | PostgreSQL | Docker Compose pins 16; embedded-dev fallback runs 18 (same feature set used) |
| ORM | Prisma + SQL migrations | partial unique indexes via raw SQL where required |
| API | NestJS modular monolith, REST `/api/v1`, OpenAPI (Swagger at `/api/docs`) | |
| Auth | scrypt password hashing + JWT access token (15 min) + rotating refresh token (httpOnly cookie, hashed server-side) | scrypt chosen over argon2 to avoid native build requirements; both acceptable |
| Frontend | React + Vite + Tailwind + TanStack Query | hand-rolled shadcn-style primitives in `components/ui` |
| Tests | Vitest (unit) + Supertest against real Postgres (API/integration) + Vitest/Testing-Library (web) + Playwright (E2E smoke) | |

## Layering

```
Web SPA ──REST /api/v1──▶ API modules (Auth, Employees, Customers, Crops, Leads, Audit)
                            │ RBAC guard (permissions) → service layer (transactions,
                            │ business rules, validation) → AuditService → Prisma
                            ▼
                        PostgreSQL 16  (migrations + seed)
Integration abstraction (Month 2+): AutoDialerProvider / MessagingProvider interfaces
  with Mock providers now; vendor adapters later. CRM business logic never imports a vendor SDK.
```

## Cross-cutting decisions

- **Identity**: a single `employees` table shared with the future HRMS. Never a CRM-only user table.
- **Ownership**: `lead_ownership` (agent → prospect) is a distinct concept from
  `relationship_ownership` (RM → converted customer, Month 4). Never merged.
- **Audit**: append-only `audit_events` table written explicitly by domain services after
  successful mutations (no request deep-clone magic). Contains actor, entity, action,
  `before`/`after` JSONB snapshots.
- **Errors**: success responses are plain resources; lists return `{items,total,page,pageSize}`.
  Errors always use `{ error: { code, message, details? } }` with REST status codes
  (409 for duplicate phone).
- **Soft delete**: business records (`customers`, phones, locations, crops, customer_crops,
  leads) carry nullable `deleted_at` and are excluded from queries. Ownership and audit rows
  are never deleted — they are history.
- **UUID PKs** everywhere; `created_at`/`updated_at` timestamptz maintained by the app layer.
- **Phone numbers**: normalized to canonical E.164 (digits stored with `+`, e.g. `+919876543210`)
  at the API boundary; stored canonical form is searchable; duplicate prevention is a partial
  unique index on non-deleted rows **plus** an application-layer check.

## Provisional items (awaiting PRD)

- Permission matrix per role (`docs/permissions.md`).
- Customer identity fields beyond name (flagged open).
- Lead status vocabulary and source taxonomy.
- Seed reference data (crops, demo names).
