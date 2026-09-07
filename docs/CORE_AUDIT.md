# GROTEC FarmerOS — CORE AUDIT

**Auditor:** Claude Code  
**Date:** 2026-09-06  
**Scope:** `apps/api/src`, `packages/shared/src`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`  
**Basis:** Source code inspection only. No speculative findings.

---

## FINDINGS

---

### 1. `RelationshipOwnership` missing partial unique index

| Field | Value |
|---|---|
| Severity | High |
| Category | PostgreSQL / Data Integrity |
| File | `apps/api/prisma/migrations/20260904064942_init/migration.sql` |
| Relevant code | Lines 296–301 only define partial unique for `lead_ownership`. `relationship_ownership` has no `WHERE released_at IS NULL` partial unique index. |
| Current behavior | `leads.ownership` has `UNIQUE INDEX ON ("lead_id") WHERE "released_at" IS NULL`. `relationship_ownership` has only a regular index on `(customer_id)`. |
| Technical flaw | `RelationshipService.assign()` releases the current owner, then inserts the new row inside a transaction — which prevents a concurrent transaction from also assigning. However, if two simultaneous requests arrive and pass the application-layer check, the DB allows both inserts because there is no partial unique constraint. |
| Impact | Two managers could become the active RM for the same customer under race conditions. This violates the PRD §6.4 invariant that a customer has exactly one current RM. |
| Recommended fix | Add: `CREATE UNIQUE INDEX "relationship_ownership_current_customer_idx" ON "relationship_ownership" ("customer_id") WHERE "released_at" IS NULL;` in the next migration. Prisma schema comment should note this is migration-only. |

---

### 2. AuthSession table has no index on `tokenHash`

| Field | Value |
|---|---|
| Severity | Medium |
| Category | PostgreSQL / Performance |
| File | `apps/api/prisma/schema.prisma` (lines 202–217) |
| Relevant code | `AuthSession` model: only `@@index([employeeId])` and `@@index([expiresAt])`. No index on `tokenHash`. |
| Current behavior | `auth.service.ts:114` — `rotateSession()` runs: `prisma.authSession.findFirst({ where: { tokenHash } })`. `logout()` runs the same query. Both are `O(n)` table scans without an index. |
| Technical flaw | Session lookup by token hash is unindexed. With thousands of sessions, every token rotation and logout causes a sequential scan. |
| Impact | Latency spikes on auth endpoints under load. Risk of timeout if session table grows large. |
| Recommended fix | Add `@@index([tokenHash])` to `AuthSession` in Prisma schema. This index should be unique eventually — but only after all old sessions with duplicate hashes are cleared, since `tokenHash` (SHA-256) has no uniqueness guarantee. |

---

### 3. Prisma schema does not reflect the partial unique indexes that exist in the database

| Field | Value |
|---|---|
| Severity | Low (Architectural Gap) |
| Category | PostgreSQL / Prisma |
| File | `apps/api/prisma/schema.prisma` |
| Relevant code | Schema comment (line 4–5): "Partial unique indexes (active-row uniqueness) are added via raw SQL in the init migration — Prisma schema cannot express partial indexes." The schema has `@index` (not `@unique`) on `customer_phones.customerId`, and no index at all on `lead_ownership.leadId`. |
| Current behavior | The actual database has 6 partial unique indexes added in migration SQL (phone active, phone single-primary, customer-crop active, lead ownership current, employee active leads). Prisma has no knowledge of these. |
| Technical flaw | Schema drift: Prisma introspect or `prisma db pull` would generate different constraints. Type-safe code using Prisma Client cannot reference these constraints. If the migration is ever reset, developers may not know which partial unique indexes to recreate. |
| Impact | Developer confusion; potential for Prisma and raw SQL to conflict if schema is regenerated. Not a runtime bug — the DB is correct. |
| Recommended fix | Document all migration-only constraints in `docs/database.md` with the exact SQL. Consider adding `@@ignore` comments to Prisma fields that are governed by migration constraints. |

---

### 4. Messaging delivery runs after transaction commit (no transactional outbox)

| Field | Value |
|---|---|
| Severity | Critical |
| Category | Transactional Outbox |
| File | `apps/api/src/modules/messaging/messaging.service.ts:39–79` |
| Relevant code | `deliver(messageId)` calls the external provider after the HTTP response is returned. It is NOT called within any transaction. |
| Current behavior | `MessagingService.queue()` creates an `outbound_message` row inside the caller's transaction. `deliver()` is called synchronously by the caller after the transaction commits. If the process crashes between commit and delivery finishing, the message row stays `PENDING` forever. |
| Technical flaw | Dual-write without an outbox. The message row is written in the business transaction but the delivery side effect is not guaranteed. |
| Impact | Farmers never receive SMS product details or follow-up reminders. Silent message loss. |
| Recommended fix | Add an `outbox_event` table. Within the business transaction, write the event intent to the outbox table alongside the business state. A separate worker polls the outbox, delivers, and marks processed. |

---

### 5. No domain event infrastructure

| Field | Value |
|---|---|
| Severity | Critical |
| Category | Domain Events |
| File | All service files |
| Relevant code | `PayrollService.publish()` (payroll.service.ts:369–439) directly calls `appNotification.create()`, `advanceLedger.update()`, `advanceRecovery.create()` — all inline. No event bus exists. |
| Current behavior | All side effects are hard-coded in the publishing service. To add email notifications, WhatsApp, or ERP webhooks, the payroll service must be modified directly. |
| Technical flaw | Tight coupling between domain logic and side effects. No ability to replay events or add consumers without modifying the source service. |
| Impact | Brittle code; adding downstream integrations requires risky changes to core payroll logic. |
| Recommended fix | Introduce a `DomainEvent` interface + `EventEmitter`. Publish events from services; handle side effects in `@EventHandler` decorated handlers. Use the outbox table as the event store for transactional guarantees. |

---

### 6. No background job queue (BullMQ / Redis absent)

| Field | Value |
|---|---|
| Severity | Critical |
| Category | Job Queue |
| File | `package.json` — no bullmq, ioredis, or any queue dependency |
| Relevant code | `ESSLSyncService` exists but is only called on-demand from the web UI. No scheduled jobs. |
| Current behavior | ESSL sync, KPI computation, follow-up reminder notifications, and audit log exports are either manual or request-bound. |
| Technical flaw | No infrastructure for reliable scheduled or background work. The PRD (Brief §12) explicitly requires a job queue. |
| Impact | ESSL sync is not automated. No follow-up reminders. KPI computation requires a manual click. |
| Recommended fix | Add BullMQ + Redis. Define queues: `attendance.sync`, `kpi.compute`, `notification.send`, `audit.export`. Do not couple business services directly to BullMQ — use a `JobQueue` interface. |

---

### 7. Payroll publish transaction is long-running and includes external side effects

| Field | Value |
|---|---|
| Severity | High |
| Category | Transactions |
| File | `apps/api/src/modules/payroll/payroll.service.ts:369–439` |
| Relevant code | `publish()` holds a single transaction that loops over all employees, creates `advanceRecovery` rows, updates `advanceLedger`, and creates `appNotification` for every employee — all inside one DB transaction. |
| Current behavior | For 500 employees this transaction holds locks for several seconds. If any employee's notification creation fails, the entire publish rolls back. |
| Technical flaw | Long-running transaction increases lock contention and abort risk. External side effects (notifications) should not be in the same transaction as financial state changes. |
| Impact | Publish timeout under large headcount; inability to partially publish. |
| Recommended fix | Keep the transaction short: update `payroll_run.status = PUBLISHED` only. Move advance recovery and notification creation to the outbox. This also enables independent retry of failed notifications. |

---

### 8. Audit failures are swallowed silently

| Field | Value |
|---|---|
| Severity | High |
| Category | Audit |
| File | `apps/api/src/common/audit/audit.service.ts:58–61` |
| Relevant code | `catch (err) { console.warn('Audit record warning:', ...); }` — no throw, no retry, no metric. |
| Current behavior | If `audit_event` insert fails (WAL saturation, disk full, constraint violation), the business operation succeeds and the audit record is permanently lost. |
| Technical flaw | Audit is the primary accountability mechanism. Silent failure defeats its purpose. |
| Impact | Compliance gap: business operations occur without an audit trail. No alert to operators that auditing has failed. |
| Recommended fix | Add a retry queue (in-memory or Redis-backed) for failed audit writes. Emit a warning metric on failure. Log the full context (actor, action, entity) separately so something survives even if the DB write fails. |

---

### 9. No idempotency on mutation endpoints or webhooks

| Field | Value |
|---|---|
| Severity | Critical |
| Category | Idempotency |
| File | `apps/api/src/modules/calls/dialer-webhook.controller.ts`; all mutation endpoints |
| Relevant code | `DialerWebhookController` calls `calls.syncSnapshotFromWebhook()`. No idempotency key. ESSL webhook similarly has no dedup. |
| Current behavior | Provider redelivers a webhook → same call status update is applied twice. Network retry of a mutation → duplicate business state changes. |
| Technical flaw | No `Idempotency-Key` header support. No webhook dedup constraint. No protection against double-apply of call status updates. |
| Impact | Duplicate call records; incorrect call outcomes; double-sent notifications; potential payroll inaccuracy from duplicate ESSL punches. |
| Recommended fix | Add `@@unique([device_id, external_biometric_id, punch_at])` on `essl_punches` (partially exists — check migration). Add `idempotency_key` to `outbound_message` and use it as a guard. Accept `Idempotency-Key` header on POST endpoints. |

---

### 10. Login rate limiter is in-memory (fails under horizontal scaling)

| Field | Value |
|---|---|
| Severity | High |
| Category | Authentication |
| File | `apps/api/src/modules/auth/rate-limit.service.ts:14` |
| Relevant code | `private readonly buckets = new Map<string, AttemptBucket>()` — a Node.js in-memory map. |
| Current behavior | Rate limit state lives in a single Node process. With PM2 cluster or Kubernetes replicas, each instance has its own map — an attacker bypasses rate limits by distributing requests across instances. |
| Technical flaw | In-memory state is not shared across instances. |
| Impact | Brute-force login attacks are viable under load-balanced deployments. |
| Recommended fix | Use Redis-backed rate limiting (e.g., `ioredis` + `lua` script). At minimum, document the single-instance constraint prominently until Redis is available. |

---

### 11. Refresh token rotation has no maximum window

| Field | Value |
|---|---|
| Severity | Medium |
| Category | Authentication |
| File | `apps/api/src/modules/auth/auth.service.ts:112–156` |
| Relevant code | `rotateSession()` checks `revokedAt === null` and `expiresAt > now`. No check on how many times the token has been rotated or how much time has passed since first issue. |
| Current behavior | A stolen refresh token can be rotated indefinitely within its TTL (default 30 days). Each rotation creates a new token and revokes the old one — but an attacker with continuous access can maintain a valid session indefinitely. |
| Technical flaw | No rotation window limit. No detection of token theft via geographic or behavioral anomaly. |
| Impact | Persistent session hijacking if a refresh token is leaked but not immediately revoked. |
| Recommended fix | Add `rotatedAt` column to `auth_session`. On rotation, check `(now - rotatedAt) > ROTATION_WINDOW` (e.g., 7 days). If exceeded, revoke all sessions for that user and force re-login. |

---

### 12. No correlation ID / request ID propagation

| Field | Value |
|---|---|
| Severity | High |
| Category | Observability |
| File | All controller and service files |
| Relevant code | No `X-Request-ID` header extraction. No `AsyncLocalStorage` context. No request ID in log lines. |
| Current behavior | `HttpExceptionFilter` logs errors without a request identifier. All log lines are standalone. |
| Technical flaw | Cannot correlate logs across a single request, let alone across async workers and outbox dispatch. |
| Impact | Debugging production incidents requires manual log scraping. Any future distributed tracing is impossible without this. |
| Recommended fix | Add a NestJS interceptor that extracts or generates a `correlationId`, stores it in `AsyncLocalStorage`, and includes it in all log lines and error responses. Propagate it through the outbox event payload. |

---

### 13. No structured logging

| Field | Value |
|---|---|
| Severity | High |
| Category | Observability |
| File | `apps/api/src/main.ts:15` — `console.log`. All service files use NestJS `Logger`. |
| Relevant code | `main.ts:15`: `console.log(\`API listening on ...\`)`. `HttpExceptionFilter:32`: `this.logger.error(exception.stack)`. No JSON format. |
| Current behavior | Plaintext log lines. Cannot filter by level, module, requestId, or actorId in a log aggregator. |
| Technical flaw | Unstructured output is incompatible with Datadog, Graylog, or Prometheus scraping of logs. |
| Impact | No alerting rules from logs. No searchable audit trail in production. |
| Recommended fix | Replace `Logger` with `pino` configured for JSON output. Include: `timestamp`, `level`, `module`, `correlationId`, `actorId`, `durationMs`, `statusCode`, `route`. |

---

### 14. `assistantChat()` audit is outside the transaction boundary

| Field | Value |
|---|---|
| Severity | Medium |
| Category | Audit |
| File | `apps/api/src/modules/assistant/assistant.service.ts:110–114` |
| Relevant code | `auditChat()` calls `audit.recordDirect()` (no transaction) after the LLM call succeeds and the response is returned to the caller. |
| Current behavior | If the process crashes after the LLM responds but before `auditChat()` completes, the conversation is not recorded. |
| Technical flaw | Audit write is best-effort rather than guaranteed. |
| Impact | Small fraction of AI assistant conversations missing from audit trail. |
| Recommended fix | Move the `audit.record()` call inside the same try block as the LLM call, before returning the response. Use `recordDirect()` since there is no other transaction to participate in. |

---

### 15. Health endpoint has no database connectivity check

| Field | Value |
|---|---|
| Severity | Medium |
| Category | Observability |
| File | `apps/api/src/modules/health/health.controller.ts` |
| Relevant code | Returns `200 OK` without probing the database or any external dependency. |
| Current behavior | Kubernetes liveness/readiness probes cannot distinguish a degraded API (DB down) from a healthy one. |
| Technical flaw | Health check is shallow. |
| Impact | Traffic routed to instances with broken DB connections. |
| Recommended fix | Use `@nestjs/terminus` health check that calls `prisma.$queryRaw('SELECT 1')`. Also check Redis availability once the queue is added. |

---

### 16. No health endpoint for /health/ready vs /health/live

| Field | Value |
|---|---|
| Severity | Low |
| Category | Observability |
| File | `apps/api/src/modules/health/health.controller.ts` |
| Current behavior | Single `/health` endpoint serves both liveness (is the process alive?) and readiness (can it serve traffic?) concerns. |
| Technical flaw | No distinction between a process that is running and one that is ready to receive traffic. |
| Impact | Kubernetes may route traffic to a process that has not completed migration or DB connection. |
| Recommended fix | Split into `GET /health/live` (returns 200 if process is alive) and `GET /health/ready` (checks DB + Redis before returning 200). |

---

### 17. Employee active uniqueness is not enforced by DB constraint

| Field | Value |
|---|---|
| Severity | Low (Technical Debt) |
| Category | PostgreSQL / Data Integrity |
| File | `apps/api/prisma/schema.prisma` |
| Current behavior | `employees` table has `email @unique` (global, not partial). There is no partial unique index on `email WHERE deleted_at IS NULL`. A deactivated employee keeps their email and blocks re-use. |
| Technical flaw | Emails are permanently consumed. A terminated employee's email cannot be reassigned to a new hire. |
| Impact | Email namespace exhaustion over time. For Phase 1 this is acceptable, but will become problematic at scale. |
| Recommended fix | If re-use of emails is desired: add `WHERE deleted_at IS NULL` partial unique index on `email`. Otherwise, document this as an intentional constraint. |

---

### 18. Decimal precision not explicitly declared on money fields

| Field | Value |
|---|---|
| Severity | Low (Technical Debt) |
| Category | PostgreSQL / Data Integrity |
| File | `apps/api/prisma/schema.prisma` |
| Relevant code | `SalaryRevision.netSalary @db.Decimal(12, 2)`, `AdvanceLedger.runningBalance @db.Decimal(12, 2)`, `PayrollLineItem.netPay @db.Decimal(12, 2)`. Some fields (e.g., `CustomerCrop.acreage`) have no `@db.Decimal` annotation at all. |
| Current behavior | Prisma maps `Decimal` to `numeric` with implementation-defined precision. Overflow behavior on large values is undefined. |
| Technical flaw | No explicit precision on all money fields. Potential for silent rounding or overflow in edge cases. |
| Impact | Payroll calculations on large salaries could overflow. |
| Recommended fix | Add `@db.Decimal(14, 2)` to all money fields. Standardize: `Decimal(14, 2)` for currency amounts, `Decimal(12, 3)` for quantities/acreage. |

---

### 19. No tests for core invariants

| Field | Value |
|---|---|
| Severity | High |
| Category | Testing |
| File | `apps/api/src/modules/calls/dialer/mock-auto-dialer.provider.spec.ts` |
| Current behavior | Only one test file exists: `mock-auto-dialer.provider.spec.ts`. |
| Technical flaw | No tests for: auth (login, logout, session rotation, deactivation), customer creation (duplicate phone prevention), lead ownership (concurrent assignment), transaction rollback, outbox atomicity, idempotency, RBAC enforcement, or audit creation. |
| Impact | Core invariants are verified manually or not at all. Refactoring can silently break critical behavior. |
| Recommended fix | Add invariant tests: concurrent ownership assignment (only one succeeds), duplicate phone creation (DB constraint catches race), auth session revocation on deactivation, audit record creation on every mutation. |

---

## SUMMARY

### Findings by severity

| Severity | Count |
|---|---|
| Critical | 4 (outbox, domain events, job queue, idempotency) |
| High | 7 (RM partial unique, payroll long tx, audit silent failure, rate limiter in-memory, correlation ID, structured logging, no tests) |
| Medium | 4 (AuthSession tokenHash index, refresh token rotation window, assistant audit outside tx, health no DB check) |
| Low | 4 (Prisma schema drift, employee email namespace, Decimal precision, health live/ready split) |

### Top 5 findings

1. **No transactional outbox** — messages lost on crash; must be built before any notification logic is trusted
2. **No domain event infrastructure** — payroll and all services are tightly coupled; blocks extensibility
3. **No background job queue** — PRD requirement; ESSL sync, KPI compute, reminders all unimplemented
4. **No idempotency** — webhook redeliveries and retry clients can corrupt call/payroll/attendance data
5. **No correlation ID / structured logging** — debugging production is grep-only; alerts impossible

### Recommended implementation order

```
Checkpoint B — Transactions + Database Integrity
  1. Add relationship_ownership partial unique index (migration)
  2. Add AuthSession tokenHash index (migration + Prisma schema)
  3. Shorten PayrollService.publish() transaction (move side effects to outbox)
  4. Document migration-only constraints in docs/database.md

Checkpoint C — Authentication + RBAC
  5. Add rotatedAt to auth_session; enforce rotation window in rotateSession()
  6. Add Redis-backed rate limiting (or document single-instance constraint)

Checkpoint D — Farmer + Ownership Integrity
  7. Verify relationship_ownership partial unique index (if not added in B)
  8. Add concurrent ownership assignment test (should fail before fix, pass after)

Checkpoint E — Events + Outbox + Idempotency
  9. Add outbox_event table to Prisma schema
 10. Rewrite MessagingService to write to outbox; add OutboxWorker
 11. Add DomainEvent interface + EventEmitter
 12. Add idempotency key to ESSL webhook and outbound_message
 13. Move assistantChat audit inside try block

Checkpoint F — Queue + Workers + Audit + Observability
 14. Add BullMQ + Redis; add JobQueue interface
 15. Add correlation ID interceptor (AsyncLocalStorage)
 16. Replace Logger with pino (structured JSON logging)
 17. Add Terminus health check with DB ping
 18. Add Prometheus metrics endpoint
 19. Add invariant test suite
```

### Tests currently existing

- `apps/api/src/modules/calls/dialer/mock-auto-dialer.provider.spec.ts` — unit test for mock dialer state machine

### Tests missing (minimum required)

1. **Auth:** login success, login failure (wrong password), login failure (inactive account), session rotation, logout, password change invalidates sessions, deactivation revokes sessions
2. **Customer:** create with duplicate phone (DB constraint), create with duplicate phone (race condition), phone uniqueness across soft-deleted customers
3. **Lead ownership:** concurrent assign to same lead — only one succeeds
4. **Relationship ownership:** concurrent assign to same customer — only one succeeds (will fail currently)
5. **Transaction rollback:** audit record not written when transaction fails
6. **Outbox atomicity:** outbox event written in same transaction as business state; worker processes it
7. **Outbox retry:** worker retries failed dispatch up to N times, then moves to DLQ
8. **Idempotency:** same webhook payload delivered twice — call status not double-applied
9. **RBAC:** agent accessing manager-only endpoint returns 403
10. **Audit creation:** every mutation creates an audit record with correct actor, before, after

---

*End of audit. Findings are based solely on source code inspection.*
