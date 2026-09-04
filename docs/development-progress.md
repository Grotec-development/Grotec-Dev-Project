# Development Progress

_Updated continuously. Five full months are dedicated to the CRM; each month ends with a
review/stop gate before the next begins._

## Month 1 — CRM Foundation (in progress)

Goal: strong technical foundation — identity, RBAC, customer/farmer master + phone duplicate
prevention, crops/acreage, leads + lead ownership, audit, API, responsive UI shell.

### Order of work

- [x] Repo scaffold (npm workspaces, git, tooling)
- [x] Docs skeleton (`docs/`)
- [x] Dev DB (embedded Postgres 18 fallback) running; Docker Compose (PG 16) shipped
- [x] `packages/shared` constants + phone normalization (+11 unit tests)
- [x] API scaffold (NestJS, Prisma, error envelope, Swagger)
- [x] Schema migrations + seed (roles/permissions/crops/demo; farmer-code sequence)
- [x] Auth (scrypt, rotating refresh sessions) + RBAC guard
- [x] Employees module
- [x] Customers module (phones, E.164 normalization, duplicate prevention, search)
- [x] Crops + customer crops
- [x] Leads + lead ownership
- [x] Audit (append-only)
- [x] PRD v2.1 + brief received → extracted to `docs/reference/` and reviewed; matrix/fields
      aligned (§5.2 Staff = no CRM; audit Founder-only; farmer ID; taluk)
- [x] Backend tests green — 38 integration tests + 11 shared unit tests
- [x] Live API smoke-tested on :3000 (login, RBAC, duplicate 409, lookup, assignment, audit)
- [x] Web shell + auth (role-filtered nav; four PRD CRM sections + records/admin)
- [x] Web: customers list/search + create (dup-phone handoff), profile, leads, crops, team, audit
- [x] Frontend unit tests (3) + typecheck; live demo on :5173 via Vite `/api` proxy
- [ ] Full frontend test coverage + E2E smoke (Playwright) — hardening pass
- [ ] Final docs, demo, stop gate

### Milestones reached

- **Month 1 backend foundation complete** (see commits below) — API at `:3000`, docs at
  `/api/docs`, all tests green, git history in small logical commits.
- **PRD review complete** for Month 1 scope; unresolved items tracked in `open-items.md`.
- **Month 1 web foundation live** — React SPA on `:5173` (login → role-filtered shell →
  customer records/leads/crops/team/audit) wired to the API through the Vite `/api` proxy.
  Dashboard / Agent / Relationship Manager / Knowledge Base show month-placeholder pages
  until their build months.
