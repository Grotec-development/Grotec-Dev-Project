# Architecture

_Last updated: Month 5 (CRM complete — RM workspace + AI assistant + dashboard)._

Month 4 ships the **Relationship Manager workspace**: a portfolio view over
`relationship_ownership` (My Customers for Managers, every portfolio for the Founder with an
`rmId` filter), reassignment/release of RM ownership with append-only audit history, an
unassigned-conversions queue, and customer notes on the RM panel. Month 5 ships the
**Telecaller dashboard** (`GET /dashboard/summary`) with role-scoped metrics computed from
live CRM data and a follow-ups-due board in the UI.

## System context

GROTEC FarmerOS CRM is a 5-month incremental build (see `development-progress.md`).
Month 1 delivered the foundation: shared employee identity, RBAC, customer/farmer master with
phone duplicate prevention, crops/acreage, leads + lead ownership, audit, REST API, responsive UI.
Month 2 delivers the Agent calling workspace: full-screen workspace UI, auto-dial behind an
internal provider abstraction, call records + status synchronisation, calling queue, mid-call
customer creation and call notes. Crop-product guidance powers **two surfaces over the
same data**: a browsable **Knowledge Base** page (crop → problem → recommended Grotec
product + usage; telecaller quick lookup) and a global **AI Assistant** chat that retrieves
that structured guidance for the message and feeds it (plus Grotec company context) to an LLM
behind an internal provider abstraction; every question+answer is audited. The chat answers
gracefully when no LLM is configured.
Month 3 completes the call lifecycle: exactly three outcomes (`Interested` / `Not Interested` /
`Not Answered`) recorded with `outcome` and `nextAction` kept as separate fields; Callback
creates a follow-up; Sales closes the lead, hands the customer to Relationship-Manager ownership
and enqueues an automatic product-details message behind a `MessagingProvider` abstraction.

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
Web SPA ──REST /api/v1──▶ API modules (Auth, Employees, Customers, Crops, Leads, Calls,
                            Follow-ups, Relationship, Messaging, Assistant, Dashboard, Audit)
                            │ RBAC guard (permissions) → service layer (transactions,
                            │ business rules, validation) → AuditService → Prisma
                            ▼
                        PostgreSQL 16  (migrations + seed)

Telephony (Month 2):   CallsService → DialerRegistry → AutoDialerProvider (interface)
                                                ├── MockAutoDialerProvider (dev, default)
                                                └── FutureVendorAdapter (webhook + poll, TBD)
  Vendor status pushes → POST /dialer/webhooks/:provider (shared secret) → same seam.
  CRM business logic never imports a vendor SDK; the provider id is config (DIALER_PROVIDER).

Messaging (Month 3):  CallsService (Sales outcome) → MessagingRegistry → MessagingProvider
                                                ├── MockMessagingProvider (dev, default)
                                                └── FutureVendorAdapter (SMS/WhatsApp, TBD)
  Records land in outbound_messages (PENDING/SENT/FAILED) regardless of provider; failures are
  stored and surfaced, never silent. Provider id is config (MESSAGING_PROVIDER). Channel and
  template remain OPEN per PRD §6.3.10.

Knowledge Base + Assistant:     GuidanceService — crop_product_guidance rows (crop →
  problem keywords → recommended Grotec products → usage) feed BOTH the browsable
  Knowledge Base page (view/search = assistant.use, content mgmt = assistant.manage)
  and the AI Assistant chat.

Assistant:                      AssistantService → GuidanceService (retrieval: rows from
  crop_product_guidance scored against the question + optional crop/customer context)
                                        │
                                        ▼
                              ASSISTANT_LLM_PROVIDER (internal token)
                                 ├── OpenAiCompatibleLlmProvider (env-configured, default)
                                 └── future adapters / test stubs
  No LLM key configured → graceful “assistant unavailable” answer. Q&A → audit (assistant.chat).
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
  leads) carry nullable `deleted_at` and are excluded from queries. Call/call-note rows are
  historical records and are never deleted. Ownership and audit rows are never deleted.
- **AI Assistant**: `assistant.use` gates chat; `assistant.manage` gates guidance content.
  Agents reach guidance read-only through the chat; Founder/Manager curate rows
  (`crop_product_guidance`: crop, problem keywords, recommended Grotec products, usage).
- **One active call per agent**: a 409 (`ACTIVE_CALL_EXISTS`) blocks a second in-flight call on
  the same workspace; calls in-flight on a dead provider reconcile to FAILED/UNKNOWN
  (provider returns no status → marked failed by the status-sync loop).
- **Outcome model**: `calls.outcome` and `calls.next_action` are two columns, never one combined
  status. Recording goes through one validated service method (transactional): Interested→
  Callback creates `follow_ups`; Interested→Sales closes the lead, releases the agent's lead
  ownership, assigns `relationship_ownership` to the configured RM (`RELATIONSHIP_MANAGER_EMAIL`,
  one active RM per customer) and enqueues an `outbound_messages` row. Not Answered retries stay
  un-automated (open business decision).
- **Relationship ownership (Month 4)**: append-only `relationship_ownership` rows with one
  active RM per customer (partial unique index). MANAGER role = eligible holder; the RM
  workspace is scoped per role (Manager own portfolio, Founder all). Customer notes are simple
  append-only rows (`customer_notes`) written under the caller's existing customer scope.
- **Dashboard (Month 5)**: one `DashboardService` computes the role-scoped summary with Prisma
  aggregates over calls/follow-ups/leads/customers — no cached or mocked numbers.
- **UUID PKs** everywhere; `created_at`/`updated_at` timestamptz maintained by the app layer.
- **Phone numbers**: normalized to canonical E.164 (digits stored with `+`, e.g. `+919876543210`)
  at the API boundary; stored canonical form is searchable; duplicate prevention is a partial
  unique index on non-deleted rows **plus** an application-layer check.

## Provisional items (awaiting PRD)

- Permission matrix per role (`docs/permissions.md`).
- Customer identity fields beyond name (flagged open).
- Lead status vocabulary and source taxonomy.
- Seed reference data (crops, demo names).
