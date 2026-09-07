# GROTEC FarmerOS CRM — Evidence-Based Code Quality Assessment

**Scope:** source code under `apps/` and `packages/`, package scripts, test suites, runtime configuration, and repository delivery assets.

**Assessment date:** 5 September 2026  
**Method:** static source review plus repository inspection and local verification. This is an evidence-based engineering assessment, not a claim of exhaustive penetration testing or formal compliance certification.

## Executive verdict

The application code is **above-average MVP code**: it has a coherent modular-monolith design, clear domain boundaries, typed shared constants, meaningful backend integration tests, database constraints, and useful documentation.

It is **not production-grade code yet**. The largest weaknesses are authorization gaps around contextual data, cloud/runtime safety, asynchronous reliability, security hardening, testing breadth, and entirely missing delivery automation.

### Scored rubric

Scores below use a 100-point rubric. They are exact within this rubric, not a mathematical measure of all possible software quality.

| Area | Weight | Score | Evidence-based judgement |
|---|---:|---:|---|
| Domain architecture and maintainability | 20 | 17 | Clear module boundaries, shared types, provider seams, Prisma migrations; some services are becoming large and orchestration-heavy. |
| Type safety and consistency | 10 | 8 | TypeScript strict typechecks pass; APIs use DTO validation. No lint enforcement means consistency is not automatically protected. |
| Data integrity and business correctness | 15 | 12 | Good PostgreSQL constraints, transactions, ownership history, audit logic and phone normalization; outbound integration ordering has failure holes. |
| Automated test quality | 15 | 9 | Real-PostgreSQL API integration tests are strong; browser coverage is only three tests and no committed E2E/load/security suite exists. |
| Application security | 20 | 8 | Authentication/RBAC/audit foundations are good; confirmed authorization, CORS, webhook, token-storage and rate-limit weaknesses are material. |
| Reliability and scalability | 10 | 4 | App is designed as one local process; polling, queueing, retries, locks, health semantics, and multi-replica behavior are incomplete. |
| Delivery and operability | 10 | 1 | No CI, containers, IaC, environments, metrics, alerting, backup/DR or release strategy is committed. |
| **Application code quality** | **100** | **59/100** | Suitable for controlled internal development/demo; not ready for an internet-facing production launch. |

### Separate readiness scores

| Dimension | Score | Meaning |
|---|---:|---|
| Local-development readiness | 78/100 | The code can be run, migrated, seeded, typechecked, and tested locally. |
| Production application readiness | 48/100 | Critical/high security and reliability remediation is required. |
| Cloud/DevOps readiness | 10/100 | Delivery and infrastructure foundations are almost entirely absent. |

## What is objectively good

1. **Architecture is appropriately simple.** The NestJS modular monolith is the correct choice for this product stage. Modules map to real business domains: auth, customers, leads, calls, follow-ups, relationship ownership, assistant, dashboard, and audit.
2. **Database design protects important rules.** Partial unique indexes, UUID identifiers, soft-delete conventions, append-only audit/ownership records, and Prisma migrations are good foundations.
3. **Business rules are not only in the frontend.** RBAC guards, services, DTO validation, transactions, and database constraints are used server-side.
4. **External vendors are abstracted.** Dialer, messaging, and LLM providers are behind interfaces. That avoids contaminating CRM domain logic with a specific vendor SDK.
5. **Backend test strategy is better than typical MVP quality.** API tests use a real PostgreSQL database, not mocks only.
6. **Documentation is strong.** Architecture, business rules, API contracts, database model, and open decisions are unusually well maintained for a project of this size.

## Measurable repository evidence

| Measure | Current result | Interpretation |
|---|---:|---|
| TypeScript/TSX source files | 142 | Moderate codebase size; still manageable as a modular monolith. |
| Source lines | 12,281 | Large enough to require automated quality gates. |
| Test files | 13 | Backend has coverage across major domains; frontend coverage is sparse. |
| Shared tests | 11 passing | Phone normalization is tested. |
| Web tests | 3 passing | Not sufficient coverage for a CRM UI. |
| API tests | documented as 76 across 11 suites | Broad workflow coverage, but coverage percentage and mutation/security testing are absent. |
| Typechecks | API, web, shared packages passed | Good static correctness baseline. |
| Lint implementation | none | Root `lint` script delegates with `--if-present`, but no workspace declares a lint script. It succeeds without running a linter. |
| CI/CD files | 0 | No GitHub Actions, GitLab CI, Jenkins, or equivalent pipeline files. |
| Container/IaC files | 0 | No Dockerfiles, Terraform, Pulumi, CloudFormation, Helm, Kubernetes, or ECS definitions. |

## Confirmed code findings

These are code-backed findings, not general cloud recommendations.

| Priority | Finding | Evidence | Impact | Required fix |
|---|---|---|---|---|
| P0 | AI chat reads a supplied customer ID without checking whether the caller may read that customer. | [`assistant.service.ts:57`](../apps/api/src/modules/assistant/assistant.service.ts) calls `customerContextLine(dto.customerId)`; [`assistant.service.ts:132`](../apps/api/src/modules/assistant/assistant.service.ts) loads name, crops and location without actor/scope input. | An agent can potentially send another farmer's personal/context data to the external LLM. | Before loading context, call the customer authorization service with the authenticated actor. Test agent access to another agent's customer. |
| P0 | An agent can attach a call to an arbitrary existing lead ID; no lead-ownership check is visible in the call-placement path. | [`calls.service.ts:75`](../apps/api/src/modules/calls/calls.service.ts) verifies only that the lead exists. | An agent may create a call/context path over another agent's lead/customer. | Enforce assigned-lead/customer scope for AGENT before placing or linking a call; add negative integration tests. |
| P1 | API may place a provider call before it commits the CRM call row. | [`calls.service.ts:85`](../apps/api/src/modules/calls/calls.service.ts) selects provider; [`calls.service.ts:86`](../apps/api/src/modules/calls/calls.service.ts) invokes `placeCall` before the database transaction. | A DB failure after successful vendor dialing creates an unrecorded call. | Create a durable call-intent/outbox row first; worker invokes vendor; reconcile result idempotently. |
| P1 | CORS becomes allow-any-origin when configuration is absent. | [`app-setup.ts:26`](../apps/api/src/app-setup.ts). | Unsafe when cookies/credentials are enabled; production error can silently become permissive. | Explicit allow-list; fail production startup if CORS origins are missing. |
| P1 | Webhooks have only a static secret and no replay protection. | [`dialer-webhook.controller.ts:34`](../apps/api/src/modules/calls/dialer-webhook.controller.ts). | Replay and spoofing risks; no vendor signature/timestamp/idempotency verification. | Use provider HMAC verification, constant-time comparison, timestamp window, nonce/event IDs, durable dedupe, and mTLS/IP controls where possible. |
| P1 | Login rate limiting is per-process memory. | [`rate-limit.service.ts:15`](../apps/api/src/modules/auth/rate-limit.service.ts). | Multiple replicas or restart bypass the limit; memory can grow with attack keys. | Redis-backed fixed/sliding-window limits, TTL, proxy-aware IP handling, and broader endpoint limits. |
| P1 | The readiness signal does not fail when the database fails. | [`health.controller.ts:11`](../apps/api/src/modules/health/health.controller.ts) returns a degraded body rather than a failing health status. | A load balancer may continue routing to a database-broken instance. | Add `/live` and `/ready`; readiness returns HTTP 503 when DB/critical dependencies are unavailable. |
| P1 | Message delivery is synchronous and lacks a durable retry worker. | [`calls.service.ts:363`](../apps/api/src/modules/calls/calls.service.ts) directly awaits delivery; [`messaging.service.ts:40`](../apps/api/src/modules/messaging/messaging.service.ts). | Process crash or timeout leaves `PENDING` messages without recovery; vendor outage consumes request time. | Transactional outbox + queue + worker, attempts/backoff, idempotency, DLQ, and operational dashboard. |
| P1 | Every API replica runs the call polling interval. | [`call-status-sync.service.ts:31`](../apps/api/src/modules/calls/call-status-sync.service.ts). | Duplicate polling and state races after horizontal scaling. | Dedicated worker, distributed lock, or queue partitioning by provider call ID. |
| P2 | Access token is kept in browser local storage. | [`api.ts:6`](../apps/web/src/lib/api.ts). | Any successful XSS can steal a bearer token. | Prefer an httpOnly-cookie/BFF approach; otherwise ship a strong CSP, security headers and robust XSS testing. |
| P2 | LLM HTTP call has no explicit timeout/circuit breaker/retry budget. | [`openai-compatible.provider.ts`](../apps/api/src/modules/assistant/llm/openai-compatible.provider.ts). | A slow upstream may hold API resources; cost and failure behavior are uncontrolled. | Add abort timeout, bounded retry, circuit breaker, concurrency/rate controls and telemetry. |
| P2 | Project has no effective lint gate. | Root [`package.json`](../package.json) runs workspace lint only `--if-present`; workspace package files declare no lint script/config. | Style/anti-pattern regression is not prevented automatically. | Add ESLint + TypeScript rules, Prettier check, pre-commit optional hook, and mandatory CI gate. |
| P2 | Prisma configuration uses a deprecated location. | API test output and [`apps/api/package.json`](../apps/api/package.json). | Upgrade friction when Prisma 7 is adopted. | Move Prisma configuration to `prisma.config.ts`. |

## Test-quality reality

The API test suite is the strongest part of the quality story. It exercises auth, RBAC, customers, leads, calls, outcomes, relationship ownership, dashboard, audit, and assistant workflows against PostgreSQL.

It is still incomplete for production because it does not demonstrate:

- Browser E2E coverage for login/session refresh, role-specific navigation, customer editing, call flow, conversion, and dashboard drill-down.
- Authorization regression tests for the two P0 scope issues above.
- Contract tests against real dialer, messaging, and LLM providers.
- Failure/retry/idempotency tests for webhook and message delivery.
- Load tests for concurrent agents, dashboard queries, and call synchronization.
- Security tests for CORS, cookies, refresh-token reuse, rate-limit bypass, injection, and abuse paths.
- Code coverage thresholds or mutation testing.

## Code-quality remediation order

### Release blocker — before cloud launch

1. Fix assistant and call-placement authorization scope.
2. Replace permissive CORS fallback with production configuration validation.
3. Implement provider webhook signing/replay/idempotency controls.
4. Add real readiness/liveness endpoints and graceful shutdown.
5. Replace direct integration calls with transactional outbox + queue worker.
6. Move rate limiting and distributed locking to Redis.

### Required before the first production release

1. Add Dockerfiles, CI pipeline, image registry, IaC, staging, monitoring, backups, and rollback.
2. Add ESLint/Prettier, secret scanning, SCA, SAST, container scanning, and SBOM generation.
3. Add Playwright E2E suite and meaningful coverage gates.
4. Add LLM controls: PII minimization, timeout, quota, rate limit, safe provider contract, and observability.
5. Move Prisma configuration to the supported configuration format and resolve toolchain warnings.

### Can wait until post-launch, but should be planned

- PostgreSQL full-text search/relevance improvements for the knowledge base.
- Dashboard read-model/caching only after measured query pressure.
- Separate worker service and API service into independently scaled deployments.
- Formal data-retention policy, audit export, and SIEM integration.

## Bottom line

The engineering is **not low quality**, but it is **incomplete quality**: business-domain code is substantially better than cloud/security/operational code. The correct honest position is:

> The project is a strong internal MVP and a reasonable foundation for production work. It is not yet safe or operationally mature enough for a public or business-critical cloud launch.

The fastest route to a credible production release is not new CRM functionality. It is remediation of the P0/P1 findings, followed by CI/CD, containerization, managed cloud infrastructure, async workers, observability, and E2E/security testing.
