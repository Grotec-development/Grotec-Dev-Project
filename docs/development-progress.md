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
  Dashboard / Agent / Relationship Manager show month-placeholder pages until their build
  months (the Knowledge Base placeholder was replaced by the AI Assistant — see below).

## Month 2 — Agent Calling Workspace (in progress)

Goal (PRD §6.3, priority #1): a full-screen calling workspace — dial, view customer context,
record the call, without navigating away. Call outcomes are Month 3; Month 2 records the call.

### Order of work

- [x] PRD §6.3 review → design approved (queue = assigned leads + phone search;
      mock dialer simulates connected calls; both configurable)
- [x] Permissions `call.read` / `call.manage` (AGENT/MANAGER/FOUNDER; Staff none) + call
      audit actions + canonical call-state constants
- [x] Schema: `calls` + `call_notes` (migration `20260904130000_calls`) + seed demo history
- [x] `AutoDialerProvider` abstraction + `MockAutoDialerProvider` (env-configurable timings /
      answer rate) + `DialerRegistry` (provider by config, never hard-coded)
- [x] Calls module: place (phone resolution, 409 one-active-per-agent), detail (provider
      sync), end, notes, queue, customer call history, call context
- [x] Status synchronisation: background poller + webhook endpoint `POST /dialer/webhooks/:provider`
      (shared secret) → same reconciliation; orphaned calls reconcile to FAILED after restart
- [x] Mid-call customer creation links the in-flight call immediately (PRD §6.3.5) — the
      call is never interrupted
- [x] Backend tests green — 53 total (calls e2e × 11 incl. RBAC/webhooks/linking + mock
      dialer unit × 4 + prior suites)
- [x] Agent workspace UI — queue, dial-any-number, live call status + timer, customer
      context panel (profile/location/crops/acreage/lead/call history/notes; follow-ups
      placeholder until Month 3), note composer, mid-call create-customer modal
- [x] Live verified on `:5173` (dial → DIALING → CONNECTED → note → end) + smoke on `:3000`
- [ ] Call outcome recording (Interested/Not Interested/Not Answered + next action) — Month 3

### Month 2 summary

- **Backend**: calls module + provider abstraction behind `docs/architecture.md`;
  webhooks + polling share one reconciliation path; e2e suite covers dial/resolve/link/end/
  queue/notes/history/context/webhooks/RBAC.
- **Frontend**: `/agent` is now the full-screen workspace (month placeholder removed).
- **Open items added**: queue formation (provisional), one-active-call rule, real vendor
  webhook contract — see `docs/open-items.md` #7–9.

## Feature change (Sept 4): Knowledge Base → AI Assistant chat

Approved scope change: remove the Knowledge Base page/nav/route and replace the static lookup
with a global AI-assisted chat widget across the whole authenticated app.

### Order of work

- [x] Permissions `assistant.use` (chat: FOUNDER/MANAGER/AGENT) + `assistant.manage`
      (guidance content: FOUNDER/MANAGER); audit action `assistant.chat`; entity types
      `ASSISTANT` / `CROP_PRODUCT_GUIDANCE`
- [x] Schema: `crop_product_guidance` (crop → problem keywords → recommended Grotec products
      → usage) — migration `20260904140000_assistant`
- [x] Seed: role matrices + 13 starter guidance rows using the real Grotec catalog
      (docs/company-context.md); rows editable by Founder/Manager
- [x] Assistant module: `POST /assistant/chat` (retrieval scoring → Grotec company-context
      prompt → LLM behind the `ASSISTANT_LLM_PROVIDER` token → answer + `sources`; every
      Q&A audited; graceful “assistant unavailable” when `LLM_API_KEY` is missing), plus
      guidance content endpoints `GET/POST /assistant/guidance`, `PATCH /assistant/guidance/:id`
- [x] Backend tests green — 57 total (+4 assistant e2e: stub-LLM happy path with sources +
      audit, staff 403, no-key fallback, guidance RBAC + CRUD)
- [x] Web: removed Knowledge Base nav item + route + page; floating “Ask Grotec Assistant”
      widget in the shell (collapsible panel, message history in React state only, Sources
      lines under answers, hidden for users without `assistant.use`); Agent workspace
      auto-passes the active call's farmer + crop into the widget
- [x] Docs aligned (permissions/api/architecture/open-items/company-context) + live preview
      verified (widget appears per-role; mid-call question carries “Helping Ramesh Patel ·
      crop context attached”; graceful no-key answer)

### Notes

- The earlier “no AI-assisted features” guardrail is superseded for CRM scope by this approved
  feature change (recorded in `open-items.md`). No vendor is hard-coded — the LLM provider is
  an internal abstraction configured by env (`LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`).
