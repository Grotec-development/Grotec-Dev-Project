# GROTEC FarmerOS — CORE TECHNICAL AUDIT

**Auditor:** Claude Code  
**Date:** 2026-09-06  
**Scope:** `apps/api/src` + `packages/shared/src` + `prisma/schema.prisma`  
**Basis:** Actual source code inspection — no speculation.

---

## 1. Current Architecture

**Stack**

| Layer | Technology |
|---|---|
| API | NestJS 10 modular monolith |
| ORM | Prisma 5 + PostgreSQL 16 (Docker) / embedded Postgres 18 (dev) |
| Auth | JWT access tokens (15 min) + rotating httpOnly refresh tokens (hashed, session-bound) |
| Frontend | React 18 + Vite + Tailwind + TanStack Query |
| WS | npm workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`) |

**Module map** (all confirmed present in `app.module.ts`):

```
ConfigModule → PrismaModule → AuditModule → AuthModule → EmployeesModule
→ CustomersModule → CropsModule → LeadsModule → CallsModule → FollowUpsModule
→ MessagingModule → RelationshipModule → DashboardModule → AssistantModule
→ AttendanceModule → LeaveModule → PayrollModule → KpiModule
→ HrmsDashboardModule → NotificationsModule → HealthModule
```

Global guards: `APP_GUARD → AuthGuard` (JWT verification), `APP_GUARD → PermissionGuard` (RBAC).

**Key architectural patterns confirmed in code:**

- Services use `prisma.$transaction(async (tx) => { ... })` for all multi-step mutations
- `AuditService.record(tx, ...)` called inside transactions (never after commit, except auditChat)
- Phone E.164 normalization + partial unique index: `phone_e164 WHERE deleted_at IS NULL`
- Append-only `lead_ownership` and `relationship_ownership` tables
- Provider abstraction: `MessagingRegistry` + `MessagingProvider` interface; `AutoDialerRegistry` + `AutoDialerProvider` interface; `LlmProvider` interface
- All mutations gated by `outranks()` role-hierarchy checks

---

## 2. Existing Core Capabilities

### Identity & Auth

- `AuthService.login()`: rate limit check → scrypt password verify → create `auth_session` (hashed token) + audit + JWT sign, all in one transaction
- `AuthService.rotateSession()`: finds session by `tokenHash = sha256(incoming)`, checks `revokedAt`/`expiresAt`, revokes old + creates new
- Tokens stored as `sha256` hashes — never plaintext
- `RateLimitService`: 5 attempts per 15-min window, keyed by `email|IP`, in-memory
- `changePassword()` invalidates ALL sessions via `authSession.updateMany`
- `JwtModule` registered globally; `AuthGuard` uses `@Public()` decorator to skip JWT verification

### RBAC

- `RolePermission` seed table; `PermissionGuard` enforces `@RequirePermission()` decorator
- Permission guard requires ALL permissions (not ANY): `required.filter(p => !granted.has(p))`
- `outranks()` for role-hierarchy checks (FOUNDER > MANAGER > AGENT/STAFF/DELIVERY)
- `PROPOSED_ROLE_PERMISSIONS` matrix in `packages/shared/src/permissions.ts`

### Data Integrity

- `CustomerStatus` enum: `ACTIVE | INACTIVE` only
- `LeadStatus` enum: `OPEN | CLOSED` only
- Farmer code via `SELECT nextval('farmer_code_seq')` → `GF${padded}`
- Employee code via `SELECT nextval('employee_code_seq')` → `GE${padded}`
- `employees.deletedAt` soft delete; `employees.status` separate from `employmentStatus`
- Prisma schema has partial unique indexes on `phone_e164 WHERE deleted_at IS NULL` and on `(customer_id, released_at) IS NULL` for both ownership tables

### Transaction Usage

- `customers.service.ts`: `create()`, `update()`, phone CRUD, location CRUD, crop CRUD all wrapped in `$transaction`
- `leads.service.ts`: `assign()` releases all active owners + creates new row inside `$transaction`
- `payroll.service.ts`: `generate()`, `approve()`, `publish()` all use `$transaction`; `publish()` loops over line items inside the same transaction
- `employees.service.ts`: `create()`, `update()`, `setActive()`, `resetPassword()` all use `$transaction`
- `followups.service.ts`: `complete()` uses `$transaction`

### Audit

- `AuditService.record(db, input)` accepts `Prisma.TransactionClient | PrismaClient`
- `cleanStringForDb()` sanitizes unicode for Windows DB compatibility
- `toJsonValue()` converts Dates → ISO, BigInt → string, Decimal → JSON
- `audit.record()` failures logged but not thrown — audit never rolls back business operations

### Provider Abstractions

- `MessagingRegistry.get(id?)` — returns named provider; `MockMessagingProvider` default
- `AutoDialerRegistry.get()` — mock provider seeded; real vendor swapped without touching business logic
- `LlmProvider` interface with `available` flag + `model` property; `AssistantService.chat()` degrades gracefully when unavailable
- `AssistantService.chat()`: retrieves guidance → injects as `<guidance>` block → calls LLM → audits Q&A; graceful `unavailable` status

### Error Handling

- `ApiError` class: `badRequest/unauthorized/forbidden/notFound/conflict/tooManyRequests`
- `HttpExceptionFilter` maps: `P2002 → 409`, `P2025 → 404`, validation arrays → `VALIDATION_ERROR`, all other exceptions → `INTERNAL_ERROR`
- `INTERNAL_ERROR` stack traces logged server-side; never sent to client

---

## 3. Critical Flaws

### CF-1: No Transactional Outbox Pattern

**Location:** `messaging.service.ts:39–79`  
**Severity:** Critical  
**Current behavior:** `MessagingService.deliver()` runs as a **synchronous post-commit operation** — after the HTTP response is sent to the caller. A crash between commit and `deliver()` finishing leaves the message row as `PENDING` forever.  
**Why it is a problem:** Messages are lost silently. The call outcome transaction (which queues the message) cannot roll back the message row if delivery fails — the dual-write problem.  
**Impact:** Farmers never receive SMS confirmations; follow-up reminders never fire.  
**Recommended fix:** Add an `outbox_event` table (or reuse a dedicated `outbox_message` table). Within the transaction that records the outcome, write the message intent to the outbox table as well as the `outbound_message` row. A separate worker polls the outbox, delivers, and marks the row processed. Idempotent delivery is required.

---

### CF-2: No Domain Event Infrastructure

**Location:** All service files  
**Severity:** Critical  
**Current behavior:** Business logic is tightly coupled. When `PayrollService.publish()` marks payslips published, it also directly calls `appNotification.create()` and `advanceLedger.update()` and `advanceRecovery.create()` — all in one transaction.  
**Why it is a problem:** Cannot add side effects (e.g., send an email, trigger a webhook, update a downstream system) without modifying the publishing service. No ability to replay events. No audit trail of what happened beyond the immediate mutation.  
**Impact:** Notification logic and financial logic are inseparable. Adding WhatsApp delivery or third-party ERP sync requires touching `PayrollService`.  
**Recommended fix:** Introduce a `DomainEvent` interface + `@EventHandler()` decorator + `EventEmitter`. Publish events from services; handle side effects in handlers. For transactional safety, use the outbox as the event bus (same table, same pattern).

---

### CF-3: No Background Job Queue

**Location:** All service files  
**Severity:** Critical  
**Current behavior:** No BullMQ, no agenda, no node-cron. All operations are request-bound.  
**Why it is a problem:** The PRD (Brief §12) requires background job infrastructure. `ESSLSyncService` must run on a schedule; `KpiService.compute()` could be scheduled; audit log exports could be scheduled; follow-up reminder notifications need a cron. Without a queue, these either run on-request (fragile) or are unimplemented.  
**Impact:** ESSL sync, KPI computation, and scheduled exports are not automated.  
**Recommended fix:** Add BullMQ with Redis. Define queues: `attendance.sync`, `kpi.compute`, `notification.send`, `audit.export`.

---

### CF-4: No Idempotency Mechanism

**Location:** `calls.service.ts`, `messaging.service.ts`, `auth.service.ts`  
**Severity:** Critical  
**Current behavior:** No idempotency keys on any endpoint. Webhooks from the auto-dialer or ESSL can be replayed or double-processed. Refresh token rotation is idempotent (checked by `revokedAt`), but place-call, deliver-message, and approve-payroll are not safe to retry.  
**Why it is a problem:** Network retries, webhook redeliveries, and client-side double-clicks can cause duplicate calls, double-charged advances, double-published payrolls.  
**Impact:** Financial incorrectness in payroll; duplicate calls billed; duplicate notifications sent.  
**Recommended fix:** Add an `idempotency_key` column to `call`, `outbound_message`, `leave_application`, and `payroll_line_item` (or a dedicated `idempotency_key` table). Reject duplicate requests with `409 Conflict`.

---

## 4. High-Risk Flaws

### HF-1: Rate Limiter Is In-Memory (Single-Instance)

**Location:** `rate-limit.service.ts:14` — `private readonly buckets = new Map<string, AttemptBucket>()`  
**Severity:** High  
**Current behavior:** Login rate limiting uses a Node.js in-memory `Map`. On multi-instance deployments (PM2 cluster, Kubernetes replicas), each instance has its own map — an attacker can bypass rate limits by hitting different instances.  
**Why it is a problem:** Brute-force protection is ineffective under load balancing.  
**Impact:** Password brute-force becomes viable under horizontal scaling.  
**Recommended fix:** Use Redis-backed rate limiting (e.g., `ioredis` + `lua` script) or at minimum document the single-instance deployment constraint.

---

### HF-2: No Correlation ID Propagation

**Location:** All controller methods  
**Severity:** High  
**Current behavior:** No `X-Request-ID` or correlation ID on any request. `HttpExceptionFilter` logs errors but with no request identifier to correlate logs across services.  
**Why it is a problem:** Debugging a failed API call requires log scraping across all logs without a common thread. Any distributed tracing (future) is impossible without this.  
**Impact:** Incident investigation is manual and slow.  
**Recommended fix:** Add a NestJS interceptor that extracts or generates a `correlationId`, stores it in `AsyncLocalStorage`, and includes it in all log lines and error responses.

---

### HF-3: No Structured Logging

**Location:** `app.module.ts`, all service files  
**Severity:** High  
**Current behavior:** `Logger` from `@nestjs/common` writes unstructured text. `console.log` in `main.ts`. No JSON log format.  
**Why it is a problem:** Cannot filter, alert, or query logs in Datadog/Sentry/Graylog. Metrics cannot be extracted from log volume.  
**Impact:** Production observability is limited to error-level events only.  
**Recommended fix:** Replace `Logger` with `pino` or `winston` configured for JSON output. Include: `correlationId`, `actorId`, `durationMs`, `statusCode`, `route`.

---

### HF-4: `PayrollService.generate()` Can Re-Overwrite an Approved Payroll Run

**Location:** `payroll.service.ts:145–293`  
**Severity:** High  
**Current behavior:** `generate()` upserts the payroll run to `GENERATED` status, deletes all existing line items, and recalculates. It checks `APPROVED_LOCKED` and `PUBLISHED` and throws if locked — but only those two. If `generate()` is called on a run already in `GENERATED` status, it silently overwrites it.  
**Why it is a problem:** If a Manager clicks "Generate" twice (network retry, double-click), all line items are deleted and recalculated, losing any manual adjustments.  
**Impact:** Payroll data loss on accidental double-generation.  
**Recommended fix:** Add `idempotencyKey` to `generate()` DTO and use it as a guard. Only allow re-generation of `IDLE` or `GENERATED` runs if the request includes an explicit `force: true` flag.

---

### HF-5: Audit Failures Are Silent

**Location:** `audit.service.ts:58–61`  
**Severity:** Medium-High  
**Current behavior:** `audit.record()` catches errors and `console.warn`s — it never throws and never retries. If the `audit_event` table write fails (e.g., WAL saturation, disk full), the business operation succeeds but the audit record is lost.  
**Why it is a problem:** Audit trail is the primary accountability mechanism. A silent failure creates a blind spot in the compliance record.  
**Impact:** Missing audit events for operations that actually happened.  
**Recommended fix:** Add a retry queue (in-memory or Redis-backed) for failed audit writes. Emit a warning metric. Log the failure with full context.

---

## 5. Missing Infrastructure

### MI-1: Transactional Outbox — Not Implemented

No `outbox_event` table. `messaging.service.ts` does dual-write directly (see CF-1).

### MI-2: Domain Events — Not Implemented

No `DomainEvent` interface, no `EventEmitter`, no `@EventHandler()` decorator. All side effects are inline in service methods.

### MI-3: Job Queue — Not Implemented

No BullMQ, no Redis, no `nestjs-bullmq`. `ESSLSyncService` exists but is called on-demand from the web UI only.

### MI-4: Idempotency Keys — Not Implemented

No `idempotency_key` on any mutation endpoint. Webhook endpoints in `dialer-webhook.controller.ts` and `essl-webhook.controller.ts` are not idempotent.

### MI-5: Correlation ID / Request Tracing — Not Implemented

No `AsyncLocalStorage`, no request ID middleware, no distributed tracing SDK.

### MI-6: Structured Logging — Not Implemented

No `pino`, no `winston`. NestJS `Logger` is used directly.

### MI-7: Monitoring / APM — Not Implemented

No Prometheus metrics endpoint, no Datadog/Sentry instrumentation, no health-check depth beyond basic liveness.

### MI-8: Data Export Control — Not Implemented

No `audit_event` export with row-level access control, no rate limiting on export, no export logging. Brief §14 requires controlled + logged exports.

---

## 6. Database Risks

### DR-1: `audit_event` Table Has No Soft-Delete Protection

**Location:** `prisma/schema.prisma` — `AuditEvent` model  
**Severity:** Low  
**Current behavior:** `AuditEvent` has no `deletedAt`. Rows are append-only by convention only. A `DELETE FROM audit_event` would succeed.  
**Why it is a problem:** The audit trail is the compliance backbone. Accidental or malicious deletion is not prevented at the DB layer.  
**Impact:** Audit records can be erased.  
**Recommended fix:** Revoke `DELETE` permission on `audit_event` from the application database user. Keep only `INSERT` and `SELECT`.

### DR-2: No Partial Unique Index on `farmer_code` for Active Customers

**Location:** `prisma/schema.prisma` — `Customer` model  
**Severity:** Low  
**Current behavior:** `farmer_code` is `unique` on the full column. A deactivated customer retains their farmer code and blocks re-use.  
**Why it is a problem:** If a farmer is deactivated and a new farmer is onboarded, they cannot get the same code. For a small org this is acceptable, but it means farmer codes are permanently consumed.  
**Impact:** Farmer code namespace exhaustion over time.  
**Recommended fix:** Create a sequence that is never reused, or add `WHERE deleted_at IS NULL` partial unique index if re-use of codes is desired.

### DR-3: Decimal/Numeric Precision on Financial Fields

**Location:** `prisma/schema.prisma` — `SalaryRevision.netSalary`, `AdvanceLedger.runningBalance`, etc.  
**Severity:** Low  
**Current behavior:** Many financial fields use `Decimal` (Prisma maps to `Numeric(10,2)` by convention).  
**Why it is a problem:** No explicit precision declared in Prisma schema (e.g., `Decimal @db.Decimal(14,2)`).  
**Impact:** Potential rounding/overflow on large payroll values.  
**Recommended fix:** Add explicit precision: `@db.Decimal(14,2)` for all money fields.

---

## 7. Authentication Risks

### AR-1: Refresh Token Rotation Window Not Enforced

**Location:** `session.util.ts`, `auth.service.ts:rotateSession()`  
**Severity:** Medium  
**Current behavior:** `rotateSession()` checks `revokedAt` and `expiresAt` but not whether the token is older than the maximum rotation window. An attacker with a stolen refresh token can rotate indefinitely within its expiry window.  
**Why it is a problem:** Token theft is not detected or contained.  
**Impact:** Persistent session hijacking.  
**Recommended fix:** Add a `rotatedAt` timestamp to `auth_session` and check `(now - rotatedAt) > ROTATION_WINDOW` during rotation. If exceeded, revoke all sessions for that user.

---

## 8. Authorization Risks

### OR-1: Staff Role Scope Is Service-Layer Only

**Location:** `employees.service.ts:834–847`  
**Severity:** Low  
**Current behavior:** STAFF role can only access employees assigned to them via `EmployeeAssignment` join table. This is enforced in `EmployeesService` but NOT in other modules (e.g., `CustomersService` does not check `EmployeeAssignment`).  
**Why it is a problem:** STAFF role is scoped to employees in `EmployeesService` but has no CRM data access enforced consistently across modules.  
**Impact:** Inconsistent access control across modules.  
**Recommended fix:** Extract `assertCanAccessEmployee` into a shared `AccessControlService` or policy that all modules use.

---

## 9. Transaction Risks

### TR-1: Payroll Publish Transaction Is Long-Running

**Location:** `payroll.service.ts:369–439`  
**Severity:** Medium  
**Current behavior:** `publish()` holds a database transaction that loops over all employees, creates `advanceRecovery` rows, updates `advanceLedger`, creates `appNotification` for each employee — all in one transaction. For 500 employees, this could take 5–10 seconds.  
**Why it is a problem:** Long-running transactions increase lock contention. If any employee notification fails, the entire publish fails and rolls back.  
**Impact:** Publish timeout under large headcount.  
**Recommended fix:** Move notification creation and advance recovery to an outbox-based worker. Keep the transaction short: update payroll run status + create outbox rows.

---

## 10. Event / Queue Risks

### QR-1: No Dead-Letter Queue for Failed Jobs

**Location:** All service files  
**Severity:** Medium  
**Current behavior:** When a future job queue is added, failed jobs have no DLQ. `MessagingService.deliver()` catches errors and logs but does not retry.  
**Why it is a problem:** Transient failures (network blip, Redis reconnect) cause permanent message loss.  
**Impact:** Farmers miss notifications on temporary infrastructure issues.  
**Recommended fix:** Implement exponential backoff with DLQ in BullMQ. Cap retries at 5, move to DLQ, alert.

---

## 11. Audit Risks

### AU-1: `assistantChat()` Audit Is Outside Transaction

**Location:** `assistant.service.ts:110–114`  
**Severity:** Low  
**Current behavior:** `auditChat()` calls `audit.recordDirect()` (no transaction) after the LLM call. If the API crashes after LLM responds but before `auditChat()` completes, the chat is not recorded.  
**Why it is a problem:** The audit record is best-effort rather than guaranteed.  
**Impact:** A small fraction of AI assistant conversations may be unrecorded.  
**Recommended fix:** Write the audit event inside the same try block as the LLM call, before returning the response.

---

## 12. Integration Risks

### IR-1: ESSL Webhook Not Idempotent

**Location:** `essl-webhook.controller.ts`  
**Severity:** High  
**Current behavior:** ESSL sends punch events as webhooks. If the same punch is delivered twice (provider retry), it will create duplicate `essl_punch` and `attendance_record` rows.  
**Why it is a problem:** Duplicate attendance records mean incorrect payroll.  
**Impact:** Payroll inaccuracy from duplicate punches.  
**Recommended fix:** Add a unique constraint on `essl_punch` `(device_id, punch_time, employee_id)` or use idempotency key from webhook payload.

---

### IR-2: Auto-Dialer Webhook Not Idempotent

**Location:** `dialer-webhook.controller.ts`  
**Severity:** High  
**Current behavior:** Provider sends call status updates as webhooks. Re-delivery causes duplicate status updates on `call` records.  
**Why it is a problem:** Call status could be overwritten from `CONNECTED` back to `RINGING` by replay.  
**Impact:** Incorrect call records and outcome tracking.  
**Recommended fix:** Use `call_id + status + timestamp` dedup or idempotency token from provider payload.

---

### IR-3: Provider Secret in Environment Variable

**Location:** `main.ts`, `auth.module.ts`  
**Severity:** Medium  
**Current behavior:** `JWT_ACCESS_SECRET`, database URL, LLM API key all read from env vars with no secret manager integration.  
**Why it is a problem:** Secrets are not rotated automatically; not audited; can leak in CI logs.  
**Impact:** Secret rotation requires redeployment; accidental exposure in logs.  
**Recommended fix:** Use a secret manager (AWS Secrets Manager / Vault) for production. Document the constraint for Phase 1.

---

## 13. Observability Gaps

### OG-1: No Health Check Depth

**Location:** `health.controller.ts`  
**Severity:** Medium  
**Current behavior:** `/health` returns `200 OK`. No checks for database connectivity, Redis availability, external provider reachability.  
**Why it is a problem:** Kubernetes/load balancer health checks cannot distinguish a degraded service from a dead one.  
**Impact:** Traffic routed to unhealthy instances.  
**Recommended fix:** Add a `Terminus` health check that pings Prisma and optionally Redis.

---

### OG-2: No Metrics Endpoint

**Severity:** Medium  
**Current behavior:** No Prometheus `/metrics` endpoint. No request latency histograms, no error rate counters, no queue depth gauges.  
**Why it is a problem:** Cannot build dashboards, alerts, or capacity plans.  
**Impact:** Blind to performance regressions.  
**Recommended fix:** Add `prom-client` + `@nestjs/terminus`. Expose: request duration, error rate, DB query duration, active sessions.

---

## 14. Recommended Changes

| Priority | Finding | Action |
|---|---|---|
| **P0** | CF-1: No outbox | Add `outbox_event` table; move message delivery to worker |
| **P0** | CF-3: No job queue | Add BullMQ + Redis; migrate ESSL sync and KPI compute to scheduled jobs |
| **P0** | CF-4: No idempotency | Add `idempotency_key` to `call`, `outbound_message`, webhooks |
| **P1** | CF-2: No domain events | Add `DomainEvent` + `EventEmitter`; decouple payroll side effects |
| **P1** | IR-1, IR-2: Webhooks not idempotent | Add dedup constraint on ESSL punches; add idempotency token on dialer webhooks |
| **P1** | HF-1: Rate limiter in-memory | Move to Redis; document single-instance constraint until then |
| **P1** | HF-2: No correlation ID | Add `AsyncLocalStorage` + interceptor; include in all log lines |
| **P1** | HF-3: No structured logging | Replace NestJS Logger with `pino`; JSON format |
| **P2** | HF-4: Payroll double-generation | Add idempotency key guard to `generate()` |
| **P2** | OG-1: Health check depth | Add DB ping to `/health` |
| **P2** | OG-2: No metrics | Add Prometheus endpoint |
| **P2** | AR-1: Refresh token rotation window | Add `rotatedAt` check; revoke old sessions on window expiry |
| **P2** | AU-1: Audit outside transaction | Move `auditChat()` inside try block |
| **P3** | DR-1: No DELETE guard on audit | Revoke DELETE on `audit_event` |
| **P3** | TR-1: Long payroll publish tx | Shorten tx; move side effects to outbox workers |
| **P3** | DR-3: Decimal precision | Add `@db.Decimal(14,2)` to all money fields |
| **P3** | IR-3: Secret management | Document env-only constraint; plan for Vault/AWS Secrets Manager |

---

## 15. Implementation Order

```
Phase A — Zero-Dependency Foundation (no new packages)
  1. Correlation ID interceptor (AsyncLocalStorage)
  2. Structured logging with pino (JSON format)
  3. Idempotency keys on call webhook + dialer webhook
  4. Idempotency keys on payroll generate()
  5. Move auditChat() inside the chat try block
  6. Add rotatedAt to auth_session; enforce rotation window
  7. Revoke DELETE on audit_event (migration)

Phase B — Outbox + Events (new tables, in-process worker)
  8. Add outbox_event table to Prisma schema
  9. MessagingService.deliver() writes to outbox instead of delivering synchronously
  10. Add in-process OutboxWorker (setInterval, 5s poll)
  11. Decouple PayrollService.publish() side effects → outbox events
  12. Add DomainEvent interface + EventEmitter (no external broker yet)

Phase C — Job Queue (BullMQ + Redis)
  13. Install bullmq + ioredis
  14. Move RateLimitService to Redis
  15. Migrate ESSL sync → BullMQ scheduled job
  16. Migrate KPI compute → BullMQ scheduled job
  17. Migrate outbox worker → BullMQ processor
  18. Add DLQ handling + alert on DLQ depth

Phase D — Observability
  19. Add Terminus health check with DB ping
  20. Add prom-client metrics (request latency, error rate, DB duration)
  21. Add Sentry/Error tracking

Phase E — Security Hardening
  22. Document secret management gap; plan for Vault/AWS
  23. Audit export with access control + rate limit
  24. Penetration-test webhook endpoints
```

---

*End of audit. Findings are based on code inspection only. No speculative issues included.*
