# CHUNK 1F — Production Supabase Migration Gap: Fixed

**Date**: 2026-09-11
**No RBAC invented. No authentication changed. No CallsService modified. No code committed or pushed.** The only production database change made was applying the repository's own pre-existing, already-reviewed Prisma migrations.

---

## 1. Root cause

Confirmed exactly as diagnosed in Chunk 1E: production's `customers` table was missing the `soil_type` column that current application code expects on every customer read (`CustomersService.fetchDetail`, `CallsService.placeCall`'s customer lookup — neither uses a narrow `select`, so all scalar columns are requested). This caused a Prisma `P2022` ("column does not exist") on `GET /customers/:id` and `POST /calls`, for every role, universally — never an authorization problem.

## 2. Previous production migration state

`npx prisma migrate status` (before any change):

```
14 migrations found in prisma/migrations
Following migrations have not yet been applied:
  20260908222000_customer_soil_type
  20260909003000_customer_referrals
  20260910120000_agent_relationship_read
```

The last migration actually applied to production had finished 2026-09-08T15:08:06Z. Everything after that point in the repository's migration history — three migrations, not one — had never reached production.

## 3. Pending migrations found (all three, not just soil_type)

| Migration | What it does |
|---|---|
| `20260908222000_customer_soil_type` | `ALTER TABLE customers ADD COLUMN soil_type VARCHAR(40)` |
| `20260909003000_customer_referrals` | Creates a new `referrals` table (append-only, FK-constrained, unique-indexed); adds two new permissions (`referral.read`, `referral.manage`) granted to FOUNDER/MANAGER/AGENT |
| `20260910120000_agent_relationship_read` | One idempotent `INSERT ... ON CONFLICT DO NOTHING` granting AGENT the pre-existing `relationship.read` permission |

## 4. Safety assessment

| Migration | Classification | Why |
|---|---|---|
| `customer_soil_type` | **SAFE ADDITIVE** | Nullable column, no default needed, no backfill, no constraint |
| `customer_referrals` | **SAFE ADDITIVE** | New table only (`CREATE TABLE IF NOT EXISTS`); FK/index creation idempotent; permission inserts use `ON CONFLICT DO NOTHING`; no existing table, column, row, or permission altered or removed |
| `agent_relationship_read` | **SAFE ADDITIVE** | Single targeted, idempotent insert; no deletes; does not touch `call.*` |

None contained `DROP`, `TRUNCATE`, `DELETE`, or a data-lossy `ALTER COLUMN`. None met the stop criteria. Transparency note: migrations #2 and #3 do grant new permissions as part of the standard, already-committed migration set — not something invented to route around the calling bug, and unrelated to `call.read`/`call.manage`.

## 5. Migration(s) applied

`npx prisma migrate deploy` — all three applied successfully in one run:

```
Applying migration `20260908222000_customer_soil_type`
Applying migration `20260909003000_customer_referrals`
Applying migration `20260910120000_agent_relationship_read`
All migrations have been successfully applied.
```

## 6. Database verification

`npx prisma migrate status` afterward: **"Database schema is up to date!"** — zero pending migrations.

## 7. `soil_type` verification (read-only)

`information_schema.columns` on production `customers`: `soil_type` (`character varying`) now present, alongside all pre-existing columns. `referrals` table confirmed present. New permission grants confirmed present exactly as the migration SQL specified (`referral.read`/`referral.manage` for FOUNDER/MANAGER/AGENT; `relationship.read` for AGENT).

## 8. Customer API result

`GET /api/v1/customers/:id` (live, via Vercel proxy, real Founder and Manager sessions, two different customer records): **HTTP 200**. No `P2022`.

## 9. Manager call result — **the actual fix, confirmed live**

Real Manager login (`manager@grotec.local`) → view customer (200) → `POST /api/v1/calls` → **HTTP 201**, call created with correct `agentId` (Manager's own id), correct `customerId`/`leadId`, mock-dialer status `DIALING` → `POST /calls/:id/end` → **HTTP 201**. Manager can place and end a call on the live production system.

## 10. Founder call result

Identical flow, real Founder session: view customer (200) → place call (201) → end call (201).

## 11. Agent regression result

- **Own lead**: real Agent session → view customer (200) → place call (201) → end call (201).
- **Another lead they don't own**: same session → `POST /calls` with that `leadId` → **HTTP 403** `LEAD_LINK_FORBIDDEN` — unchanged, still enforced. The migrations touched no calling-authorization logic, and this confirms it.

## 12. Delivery negative test

Live login for `delivery@grotec.local` using the shared password that worked for the other four accounts returned `401 INVALID_CREDENTIALS` — this one account's password differs from the rest (not something I attempted to guess further, per instruction). Fell back to the same locally-run-instance method used in Chunk 1 (current code, same production database, a legitimately-signed token for the real Delivery employee record) to complete this specific check: `POST /calls` → **HTTP 403** `FORBIDDEN — Missing permission: call.manage`. Still correctly blocked; nothing about DELIVERY's permissions was touched by these migrations.

## 13. No-token test

`POST /api/v1/calls` with no `Authorization` header (live, via Vercel proxy): **HTTP 401** `UNAUTHORIZED`.

## 14. Outbox/audit verification

For one successful live test call (since deleted as cleanup — see below): `audit_events` contained exactly two rows, `call.placed` and `call.ended`, both with the correct actor and correct `entity_id` linkage to the call. The `calls` row itself had the correct `agent_id`, `customer_id`, `lead_id`, final `status: ENDED`, `disconnect_reason: AGENT_ENDED`. Calls do not emit outbox events in this architecture (the outbox is used for other domain events — customer/lead/relationship/payroll lifecycle — not calls), so there was nothing to check there; the `outbox_events` table itself was confirmed present and untouched.

**Cleanup**: the three real test calls created during this live verification (Founder, Manager, Agent-own-lead) — and their six associated audit events — were deleted immediately after verification via targeted, ID-scoped deletes. Verified zero rows remain. This mirrors the same cleanup discipline from Chunk 1 and 1C; the actual fix (the three applied migrations) was, of course, left in place.

## 15. Build results

| Command | Result |
|---|---|
| `npm run build:shared` | ✅ pass |
| `npm run typecheck --workspace @grotec/backend` | ✅ pass, 0 errors |
| `npm run typecheck --workspace @grotec/frontend` | ✅ pass, 0 errors |
| `cd frontend && npm run build` (production Vite build) | ✅ pass |
| `backend` DB-independent unit suite (`vitest.unit.config.js`) | ✅ **122/122 passed** |

## 16. Remaining schema drift

Ran a comprehensive, read-only comparison of **all 49 Prisma models** against the live production database's actual tables and columns (via `information_schema`, cross-referenced against the generated Prisma client's DMMF — the same metadata the app itself uses to build queries). **Result: no drift found.** Every expected table and column for every model is present in production. Nothing else is silently missing.

## 17. Production readiness status

**READY.** The database, the deployed backend, and the deployed frontend are all consistent with each other and with the current codebase. Founder and Manager can both place calls end-to-end on the live production system, verified with real sessions, right now. Agent's own-lead success and other-lead 403 are both unchanged. Delivery remains blocked. Unauthenticated requests remain blocked. No further schema drift exists anywhere in the 49-model schema.
