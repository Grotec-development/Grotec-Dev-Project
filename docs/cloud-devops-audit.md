# GROTEC FarmerOS CRM — Cloud, DevOps, and Production Readiness Audit

**Audit scope:** repository architecture, runtime configuration, delivery automation, cloud readiness, reliability, security, testing, and external-provider integration design.

**Overall assessment:** The application is a well-structured CRM modular monolith with a sound domain model, RBAC, audit records, Prisma migrations, and clear provider abstractions. It is development-ready, but it is **not production-cloud-ready yet**. The repository currently has development-only infrastructure and lacks CI/CD, containers, Infrastructure-as-Code (IaC), production deployment definitions, observability, backups/DR, and worker-based asynchronous processing.

## 1. Current system design

```text
React/Vite SPA
  |
  | HTTPS; JWT access token + httpOnly refresh cookie
  v
NestJS modular-monolith API (/api/v1)
  |- RBAC guard, validation, error envelope, audit logging
  |- CRM modules: customers, crops, leads, calls, follow-ups
  |- Relationship-manager workspace and dashboard
  |- AI assistant -> OpenAI-compatible provider abstraction
  |- Dialer provider abstraction <- webhooks / polling
  `- Messaging provider abstraction
  |
  v
PostgreSQL (Prisma migrations + seed data)
```

### Existing strengths

- TypeScript is used consistently across web, API, and shared domain types.
- The API is divided into coherent NestJS modules rather than prematurely split into microservices.
- PostgreSQL constraints and raw partial indexes protect important invariants, such as active phone uniqueness and active ownership.
- RBAC, refresh-token rotation, audit events, request validation, and API error envelopes are already present.
- Dialer, messaging, and LLM integrations are behind provider abstractions, so vendor selection need not affect CRM business logic.
- Integration tests run against a real PostgreSQL test database.

Keep the modular monolith for the next stage. Separate services should be introduced only when workloads and operational ownership justify them. The asynchronous integration worker described below is the first useful separation.

## 2. CI/CD structure — implement first

```text
Developer pull request
  -> CI quality gate
     -> deterministic install from lockfile
     -> format and lint checks
     -> TypeScript typecheck
     -> unit tests
     -> API integration tests with ephemeral PostgreSQL
     -> build web and API artifacts
     -> secret, dependency/SCA, IaC, and container-image scans
     -> SBOM and build provenance
  -> merge to main
     -> publish immutable image tag
     -> deploy automatically to Development
     -> smoke test + migration verification
  -> promote the same image to Staging
     -> end-to-end, API contract, DAST, and load tests
  -> production approval
     -> backup verification
     -> migration Job
     -> canary/blue-green rollout
     -> readiness checks, monitoring, and automatic rollback
```

### CI jobs

| Stage | Required checks | Failure outcome |
|---|---|---|
| Validate | `npm ci`, format check, lint, typecheck | PR blocked |
| Test | shared unit tests, API integration tests, web unit tests | PR blocked |
| Build | API image, static web artifact, Prisma client generation | PR blocked |
| Secure | secret scan, dependency scan, SAST, image scan, SBOM | high/critical findings block release |
| Deploy dev | migration, deploy, readiness and smoke checks | automatic rollback |
| Staging | E2E, contract, DAST, load tests | promotion blocked |
| Production | approval, backup check, controlled rollout, alert watch | rollback on failed health/error-rate gates |

### Deployment rules

- Publish immutable artifacts only: commit SHA plus semantic release tag. Never promote a rebuilt image.
- Run `prisma migrate deploy` as a dedicated, versioned migration job before the compatible application release.
- Make database migrations backward compatible: expand schema, deploy compatible code, backfill, then remove old fields in a later release.
- Use protected environments and separate cloud accounts/projects for development, staging, and production.
- Use workload identity/OIDC from CI to cloud; do not store cloud access keys in CI variables.

## 3. Recommended cloud architecture

AWS is the reference implementation; the same logical components map directly to Azure or GCP.

```text
Internet
  -> CloudFront + WAF
  -> S3 static SPA
  -> Application Load Balancer
  -> ECS Fargate API service (two or more replicas; private subnets)
  -> RDS PostgreSQL Multi-AZ
  -> ElastiCache Redis
  -> SQS queues + dedicated worker service
  -> Secrets Manager / Parameter Store

Operations
  -> CloudWatch logs, metrics, tracing, alarms, error tracking
```

| Component | Responsibility |
|---|---|
| S3 + CloudFront | React build hosting, TLS, caching, CDN delivery |
| WAF | rate controls, common attack rules, geographic/IP controls where required |
| ALB | TLS termination, routing, health checks |
| ECS Fargate API | stateless NestJS API, autoscaling, rolling deployment |
| RDS PostgreSQL | managed database, Multi-AZ, backups, point-in-time recovery |
| Redis | distributed rate limits, cache, locks, queue/job coordination |
| SQS + worker | reliable messages, dialer reconciliation, retries, dead-letter processing |
| Secrets Manager | database credentials, JWT secret, vendor credentials, LLM key |
| CloudWatch/OpenTelemetry | logs, dashboards, traces, alarms, error reporting |

### Network and identity controls

- Put the API and worker in private subnets; do not expose PostgreSQL or Redis publicly.
- Allow database traffic only from API/worker security groups.
- Use least-privilege IAM roles per service.
- Use TLS end-to-end and enforce HTTPS redirects.
- Keep production secrets out of repository, Docker images, browser code, and logs.
- Run a startup configuration validator that refuses production startup when mock providers, development JWTs, insecure cookies, or wildcard CORS are configured.

## 4. Phased implementation plan

| Phase | Scope | Deliverables |
|---|---|---|
| 0 — Critical remediation | security and correctness | assistant authorization fix, CORS restriction, webhook signing, readiness checks, config validation |
| 1 — Delivery foundation | repeatable builds | Dockerfiles, CI pipeline, image registry, IaC baseline, development cloud environment |
| 2 — Staging platform | production-like validation | RDS, ECS, Redis, queues, Secrets Manager, staging domain, dashboards and alerts |
| 3 — Production resilience | safe go-live | WAF, Multi-AZ database, backups/restore testing, DR runbook, canary rollout and rollback |
| 4 — External integrations | provider reliability | real dialer/messaging adapters, signed webhooks, outbox worker, retries, DLQ, idempotency |
| 5 — Operational maturity | scaling and governance | load tests, E2E suite, retention controls, audit export, cost controls, security review |

## 5. Findings and required improvements

| Severity | Finding | Risk | Recommended remediation |
|---|---|---|---|
| Critical | The AI chat endpoint reads context from any supplied `customerId` without first enforcing the caller's customer visibility. | An agent may send another farmer's name, crops, and location to an external LLM. | Call the existing customer scope check before fetching customer context; audit this access; minimize/redact LLM context. |
| High | CORS falls back to allowing all origins when `CORS_ORIGINS` is empty. | Unsafe with credentialed refresh cookies. | Require an explicit production origin allow-list and fail startup when it is absent. |
| High | Dialer webhook authentication uses a shared-secret equality comparison only. | Vulnerable to replay; does not meet typical vendor webhook security requirements. | Verify signed HMAC payloads using constant-time comparison; require timestamps, replay IDs, idempotency, and vendor IP rules where available. |
| High | Message delivery occurs synchronously after the outcome transaction. | A process crash can leave messages permanently `PENDING`; no retry worker exists. | Implement transactional outbox plus SQS/queue worker, exponential retries, idempotency keys, and a dead-letter queue. |
| High | Login rate limiting is process-local and only protects login. | Limits disappear on restart and are ineffective across replicas. | Use Redis-backed distributed rate limits, proxy-aware client-IP handling, and API-wide endpoint limits. |
| High | The health endpoint returns a successful HTTP status even when PostgreSQL is unavailable. | Load balancers may route traffic to an unusable API. | Provide `/live` and `/ready`; return 503 from readiness for unavailable critical dependencies. |
| High | Dialer polling runs inside every API instance. | Multiple replicas can poll/sync the same calls and create races. | Move polling into one worker with a queue or Redis distributed lock. |
| Medium | Access token is stored in browser `localStorage`. | XSS can steal the bearer token. | Prefer an httpOnly-cookie/BFF model; otherwise deploy strict CSP, XSS prevention, short TTL, and security review. |
| Medium | LLM requests have no explicit timeout, retry policy, circuit breaker, or spend control. | Upstream hangs can exhaust API capacity and create uncontrolled spend. | Add `AbortController` timeout, bounded retry, circuit breaker, concurrency/rate limits, quotas, and usage monitoring. |
| Medium | AI retrieval loads all guidance records and performs simple keyword matching. | Slow/weak relevance as guidance grows. | Start with PostgreSQL full-text search and indexes; evaluate embeddings only when actual recall needs justify them. |
| Medium | There are no formal AI privacy, retention, prompt-injection, or output-safety controls. | Farmer data and agronomy guidance can be mishandled. | Define provider/data-processing policy, redact PII, restrict prompt context, add content controls and human escalation paths. |
| Medium | Default RM selection uses one configured email. | A renamed/deactivated employee can break Sales conversion. | Replace with a durable routing configuration, active-holder validation, and fallback assignment process. |
| Medium | Follow-up dates are parsed in server-local time. | Incorrect callback times across deployment regions or daylight-saving changes. | Store and calculate in UTC, configure business timezone, and display localized time. |
| Medium | Web tests are very limited and no committed Playwright E2E setup is present. | Important CRM journeys can regress unnoticed. | Add E2E tests for login/RBAC, duplicate farmer detection, call outcome, callback, conversion, dashboard, and provider failures. |
| Medium | No committed lint, formatting, dependency-update, security-scan, or release automation configuration exists. | Quality and dependency risk grow unchecked. | Add ESLint, Prettier check, Dependabot/Renovate, SCA, secret scanning, image scanning, and release jobs. |
| Low | Prisma warns that `package.json#prisma` configuration is deprecated. | Future Prisma 7 upgrade risk. | Move Prisma settings to `prisma.config.ts`. |
| Low | The web build warns that the PostCSS config has no explicit module type. | Avoidable build noise and future tooling ambiguity. | Use an explicit `.cjs` file or declare the package module type consistently. |

## 6. Repository-level gaps

The repository does not currently include:

- CI workflow definitions.
- API or web production Dockerfiles.
- Container image registry or image-tagging strategy.
- Terraform, Pulumi, CloudFormation, Helm, Kubernetes, or ECS deployment definitions.
- Production environment templates or validated configuration schema.
- Central structured logging, tracing, dashboards, alerts, or error tracking.
- Backup/restore verification, RTO/RPO objectives, or a disaster-recovery runbook.
- Dedicated asynchronous jobs/workers, retry queues, or dead-letter queues.
- E2E/browser-test automation committed to the repository.
- Data retention, PII classification, consent, or audit-export policy.

## 7. Operational implementation brief

1. **Secure the application first.** Fix assistant customer scope enforcement, CORS behavior, health readiness, webhook validation, and production configuration validation.
2. **Containerize.** Build separate production images for the NestJS API and a static web build. Run as non-root users, define resource limits, and expose only the required port.
3. **Create IaC.** Define networking, RDS, ECS services, Redis, SQS, secrets, WAF, DNS, CloudFront, alarms, and IAM as code.
4. **Build CI/CD.** Run quality/security gates on every PR; publish signed immutable artifacts after merge; promote the same artifact through development, staging, and production.
5. **Introduce a worker.** Use an outbox record written in the same database transaction as the business event. The worker delivers messages, polls integrations, applies retries, and sends exhausted jobs to DLQ.
6. **Add observability.** Emit structured logs with request/correlation IDs. Monitor API error rate, latency, DB connections, queue depth, failed messages, webhook failures, LLM failures/latency/cost, and login abuse.
7. **Prepare recovery.** Enable RDS point-in-time restore, test restoration regularly, document RTO/RPO, and rehearse an incident/rollback procedure.

## 8. Verification notes

- Typechecking completed successfully for API, web, and shared packages.
- Shared-package tests passed: 11 tests.
- Web-package tests passed: 3 tests.
- API integration test execution uses a real PostgreSQL database and showed its core suites passing during the audit run.
- The Vite toolchain emits warnings about its deprecated CJS Node API and the web PostCSS module type.

## Conclusion

The CRM domain architecture is a solid early-release base. The main deficiency is the platform surrounding the application, not the number of CRM modules. Prioritize the critical authorization/security fixes, then establish containerized CI/CD, managed cloud infrastructure, a durable async worker, observability, and disaster recovery before a production rollout.
