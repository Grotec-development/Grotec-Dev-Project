# System Design Implementation Progress

## Status: Phases 1–12 Complete + Checkpoint E Hardening + Repository Reorganization

Last updated: 2026-09-06
Implementation: Repository reorganization (2026-09-06)

---

## Repository Reorganization (2026-09-06)

Reorganized repository into clean frontend/backend/infrastructure structure:

```
grotec-farmos/
├── backend/              ← apps/api (NestJS API)
├── frontend/             ← apps/web (React SPA)
├── packages/
│   └── shared/           ← packages/shared (no change)
├── infrastructure/
│   ├── docker/           ← docker-compose.yml
│   ├── database/         ← dev-db.mjs, init-test-db.sql
│   └── scripts/         ← extract-pdf.mjs
├── docs/                 ← docs/ (no change)
├── package.json          ← root workspace config
└── ...
```

### Changes Made:
- `apps/api` → `backend/` (NestJS REST API)
- `apps/web` → `frontend/` (React SPA)
- `infra/` contents reorganized into `infrastructure/{docker,database,scripts}/`
- Package names: `@grotec/api` → `@grotec/backend`, `@grotec/web` → `@grotec/frontend`
- Workspace paths updated in `package.json`
- Scripts updated to reference new paths
- `.gitignore` updated for new directory structure
- Source comments updated (e.g., `packages/shared/src/enums.ts`)

### Validation:
- `npm run build:shared` ✅
- `npm run typecheck --workspace @grotec/backend` ✅
- `npm run typecheck --workspace @grotec/frontend` ✅

---

## Checkpoint E Hardening — Changes

### Consumer Idempotency (Phase 5)
- **New table**: `ProcessedEvent(id, idempotencyKey, eventId, consumerName, processedAt)`
- **Unique constraint**: `(eventId, consumerName)` — authoritative DB guarantee
- **Flow**: Write ProcessedEvent BEFORE handler → if process crashes, next tick skips handler
- **File**: `apps/api/src/common/outbox/outbox-worker.ts` — STEP 2 of processEvent

### Processing Lease Recovery (Phase 6)
- **New column**: `outbox_events.leaseExpiresAt` (TIMESTAMPTZ, nullable)
- **Claim query**: `WHERE status=PENDING AND (leaseExpiresAt IS NULL OR leaseExpiresAt <= now())`
- **Claim action**: Sets `leaseExpiresAt = now() + LEASE_TTL_MS` (30 seconds)
- **Recovery**: Stale PROCESSING events become PENDING + eligible after TTL expires
- **Concurrent safety**: `OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]` in atomic UPDATE prevents double-claim

### Emitter Idempotency (Phase 3)
- **Key structure unchanged**: `eventType:aggregateId:stablePayloadHash`
- **Semantic clarification**: collapses only true business duplicates (same entity + same logical operation)
- `payroll.publish` already handles business idempotency at the service layer (returns early if PUBLISHED)
- Re-publishing the same run produces the same idempotency key → one DB row → correct

### Employee Events (Phase 4)
- `employee.deactivated` / `employee.activated` contracts defined in `packages/shared/src/events.ts`
- `EmployeesService` does not yet emit these events (no corresponding mutation wired in this session)
- Contracts remain in place; no-op handlers registered (ready for future integration)

### Migration
- `20260906210000_outbox_hardening/`: adds `lease_expires_at` column, `event_id` column (unique), `processed_events` table

### Tests
`apps/api/test/outbox-e2e-spec.ts` — 10 tests covering all guarantees (see test file)

---

## Architecture Implemented

```
CLIENTS
  |
  v
API / HTTP LAYER
  |
  v
AUTHENTICATION + RBAC (pre-existing)
  |
  v
DOMAIN SERVICES
  |
  v
DATABASE TRANSACTION
  |
  +-- Domain State (Prisma)
  +-- Audit Event (AuditService)
  +-- Outbox Event (DomainEventService)
  |
  v
COMMIT
  |
  v
OutboxWorker (background dispatcher)
  |
  v
Event Handlers (idempotent, per-event-type)
  |
  v
External Side Effects (advance recovery, notifications)
```

---

## Phase 1 — Domain Event Foundation

**File:** `packages/shared/src/events.ts`

Event contracts (stable, typed, versioned):

| Event | Aggregate | Payload fields |
|-------|-----------|----------------|
| `customer.created` | customer | farmerCode, fullName, phoneCount |
| `customer.updated` | customer | fullName |
| `customer.activated` | customer | status |
| `customer.deactivated` | customer | status |
| `lead.created` | lead | customerId, source, ownerId |
| `lead.assigned` | lead | ownerId, previousOwnerId, reason |
| `lead.reassigned` | lead | ownerId, previousOwnerId, reason |
| `lead.updated` | lead | (from payload) |
| `relationship.assigned` | customer | rmId, previousRmId, reason |
| `relationship.reassigned` | customer | rmId, previousRmId, reason |
| `relationship.released` | customer | previousRmId, reason |
| `employee.deactivated` | employee | employeeId, status |
| `employee.activated` | employee | employeeId, status |
| `payroll.published` | payroll | runId, month, employeeCount |

All events carry: `eventId` (UUID), `eventType`, `aggregateType`, `aggregateId`, `occurredAt` (ISO), `actorId`, `correlationId`, `causationId`, `schemaVersion`, `payload`.

---

## Phase 2 — Transactional Outbox

**Prisma model** (`schema.prisma`, line ~1104):
```
OutboxEvent {
  id               UUID PK
  idempotencyKey   String? @unique  -- stable logical key
  eventType        String
  aggregateType    String
  aggregateId      UUID
  payload          Json
  status           OutboxStatus (PENDING|PROCESSING|PROCESSED|FAILED)
  attempts         Int (default 0)
  maxAttempts      Int (default 3)
  lastError        String?
  nextRetryAt      DateTime?
  createdAt        DateTime
  updatedAt        DateTime
  processedAt      DateTime?
}
```

**Indexes:**
- `outbox_events_status_next_retry_at_idx` — fast claim of PENDING events
- `outbox_events_aggregate_idx` — aggregate-based projections
- `outbox_events_created_at_idx` — audit/replay ordering
- `idempotency_key` unique constraint — idempotency

**Migration:** `apps/api/prisma/migrations/20260906200000_outbox_event_table/`

---

## Phase 3 — Atomic Domain Transactions

Pattern used everywhere:
```ts
await prisma.$transaction(async (tx) => {
  await tx.domainMutation({...});      // domain state
  await this.audit.record(tx, {...});   // audit
  await this.domainEvents.emit(tx, {...}); // outbox event
});
```

**DomainEventService** (`apps/api/src/common/outbox/domain-event.service.ts`):
- `emit(db, params)` — appends outbox row inside caller-provided transaction
- Silently skips on duplicate `idempotencyKey` (P2002 → idempotent)
- `buildIdempotencyKey(eventType, aggregateId, payload)` — stable logical key

---

## Phase 4 — Integrated Domains

| Service | Method | Event Emitted |
|---------|--------|---------------|
| `CustomersService` | `create()` | `customer.created` |
| `CustomersService` | `update()` | `customer.updated` |
| `CustomersService` | `setActive()` | `customer.activated` / `customer.deactivated` |
| `LeadsService` | `create()` | `lead.created` |
| `LeadsService` | `assign()` | `lead.assigned` / `lead.reassigned` |
| `RelationshipService` | `assign()` | `relationship.assigned` / `relationship.reassigned` |
| `RelationshipService` | `release()` | `relationship.released` |
| `PayrollService` | `publish()` | `payroll.published` |

---

## Phase 5 — Idempotency

**Emitter side:** `idempotencyKey = unique` constraint in DB. Duplicate logical events → P2002 → silently skipped.

**Consumer side:** `OutboxWorker` marks `PROCESSED` after successful handler. Processed events are not re-executed (`WHERE status = 'PENDING'` in worker query).

---

## Phase 6 — Outbox Dispatcher

**OutboxWorker** (`apps/api/src/common/outbox/outbox-worker.ts`):
1. Poll every 2s for PENDING events (WHERE `nextRetryAt IS NULL OR nextRetryAt <= now()`)
2. **Safe claiming:** `UPDATE ... WHERE id=X AND status='PENDING' AND attempts=N` — only one worker wins
3. Increment `attempts` on claim
4. Execute handler
5. On success: `status = PROCESSED`, `processedAt = now()`
6. On transient failure: `status = PENDING`, `nextRetryAt = now() + BASE_DELAY * 2^attempts`
7. After `maxAttempts`: `status = FAILED`, `lastError` set, `nextRetryAt = NULL`

**EventHandlerMap** — registered at `onModuleInit` by `OutboxEventHandlers`:
- `payroll.published` → advance recovery + per-employee AppNotification
- Other events → no-op placeholders (ready for future handlers)

---

## Phase 7 — Payroll

`publish()` now:
```
DB Transaction
  + payroll_run.status = PUBLISHED
  + audit_event
  + outbox_event (payroll.published)
COMMIT
  |
  v
OutboxWorker
  |
  v
advance recovery ledger updates
per-employee AppNotification
```

`publishSideEffects()` loop **removed** — replaced by outbox.

---

## Phase 8 — Concurrency

- `WHERE status='PENDING' AND attempts=N` — atomic claim, one winner
- `P2002` on `idempotency_key` — duplicate event emission blocked at DB level
- Partial unique indexes for `LeadOwnership` and `RelationshipOwnership` — pre-existing

---

## Phase 9 — Tests

**File:** `apps/api/test/outbox-e2e-spec.ts` (10 tests)

| # | Test |
|---|------|
| 1 | `publish` writes payroll + outbox event atomically |
| 2 | Re-publishing does not create duplicate outbox events (idempotency key) |
| 3 | Customer create emits `customer.created` atomically |
| 4 | Concurrent workers: exactly one claims event (safe claiming) |
| 5 | Worker processes PENDING → PROCESSED, side effects applied |
| 6 | Per-employee failures isolated (Promise.allSettled) |
| 7 | Event reaches max attempts → FAILED, no further retries |
| 8 | Idempotency key prevents duplicate `customer.created` on retry |
| 9 | Lead create emits `lead.created` + `lead.assigned` atomically |
| 10 | Relationship assign emits `relationship.assigned` atomically |

---

## Phase 10 — Observability

Exposed fields (present in `OutboxEvent` model and `DomainEvent` interface):
- `eventId` — unique event identifier
- `correlationId` — request chain
- `causationId` — causal event chain
- `aggregateId` — affected entity
- `attempts` — retry count
- `lastError` — failure message
- `createdAt` / `processedAt` / `nextRetryAt` / `occurredAt` — timestamps

Logger used (`Logger` from `@nestjs/common`) — no new logging framework.

---

## Phase 11 — Security

- No secrets in event payloads (verified: passwords, tokens, API keys absent)
- Authorization remains at API/domain layer — outbox handlers operate on already-authorized domain state
- `idempotencyKey` derived from stable payload fields, not secrets

---

## Phase 12 — Performance

- Transactions are short: domain mutation + audit + outbox write only
- No network calls inside transactions
- `batchSize = 50` per worker tick
- Indexes support all query patterns

---

## Validation

```
npm run build:shared   ✅ (0 errors)
npm run typecheck --workspace @grotec/backend  ✅ (0 errors)
npm run typecheck --workspace @grotec/frontend  ✅ (0 errors)
npm run lint            ⚠️  (no lint tool configured)
```

E2e tests: **NOT RUN** — PostgreSQL unavailable (Docker not running).

---

## Blockers

| Blocker | Impact | Notes |
|---------|--------|-------|
| PostgreSQL unavailable | E2e tests cannot run | Docker daemon not running |
| `employee.deactivated` / `employee.activated` events | Not wired into `EmployeesService` | Defined in contracts; handlers registered as no-op |

---

## Files Changed / Added

### New
- `packages/shared/src/events.ts` — event contracts
- `backend/src/common/outbox/domain-event.service.ts`
- `backend/src/common/outbox/outbox-worker.ts`
- `backend/src/common/outbox/outbox.module.ts`
- `backend/src/common/outbox/event-handlers.ts`
- `backend/prisma/migrations/20260906200000_outbox_event_table/`
- `backend/test/outbox-e2e-spec.ts`

### Modified
- `backend/prisma/schema.prisma` — OutboxEvent model + OutboxStatus enum
- `backend/src/app.module.ts` — OutboxModule import
- `backend/src/modules/payroll/payroll.service.ts` — event emit, removed publishSideEffects
- `backend/src/modules/customers/customers.service.ts` — event emit in create/update/setActive
- `backend/src/modules/leads/leads.service.ts` — event emit in create/assign
- `backend/src/modules/relationship/relationship.service.ts` — event emit in assign/release
- `backend/test/helpers.ts` — resetData includes outbox_event.deleteMany
- `packages/shared/src/index.ts` — exports events.ts (already present)
- `backend/test/global-setup.ts` — ensurePartialUniqueIndexes (pre-existing)
