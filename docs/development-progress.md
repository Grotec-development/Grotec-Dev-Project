# Development Progress

_Updated continuously. Five full months are dedicated to the CRM; each month ends with a
review/stop gate before the next begins._

## Month 1 — CRM Foundation (complete)

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

## Month 2 — Agent Calling Workspace (complete)

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
- [x] Call outcome recording — completed in Month 3 (below)

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

### Knowledge Base page restored (same day, user request “add knowledge base also”)

- The browsable Knowledge Base is back at `/knowledge-base` alongside the chat — both use the
  same `crop_product_guidance` data. View/search = `assistant.use` (agents can now `GET
  /assistant/guidance`, active rows only); create/edit/retire = `assistant.manage` (Founder/
  Manager, incl. `includeInactive`). Crop/problem/product search + filters + entry editor UI.
  Backend e2e updated (agent browse happy path + retired-row visibility) — 76 API tests green.

### Notes

- The earlier “no AI-assisted features” guardrail is superseded for CRM scope by this approved
  feature change (recorded in `open-items.md`). No vendor is hard-coded — the LLM provider is
  an internal abstraction configured by env (`LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`).

## Month 3 — Call outcomes + follow-ups + sales progression (complete)

Goal (PRD §6.3.6–6.3.10, §11): the complete CRM call lifecycle — exactly three outcomes with
`outcome` and `nextAction` stored separately, Callback → follow-up, Sales → RM handoff +
automatic product message, all validated and tested.

### Approved at kickoff

- Progression model: `leads.status` stays OPEN/CLOSED (operational flag); Sales → CLOSED +
  agent ownership released; Not Interested → CLOSED; interest history = call outcomes.
- RM on Sales: auto-assign `RELATIONSHIP_MANAGER_EMAIL` (seeded `manager@grotec.local`) →
  `relationship_ownership` (one active per customer). Roster/reassignment = Month 4.

### Order of work

- [x] Shared enums: `CallOutcome`, `NextAction`, `FollowUpStatus`, `MessageStatus` + audit
      codes (`call.outcome_recorded`, `followup.created/completed`, `relationship.assigned`,
      `message.product_details_sent/failed`) + entity types (`FOLLOW_UP`,
      `RELATIONSHIP_OWNERSHIP`, `OUTBOUND_MESSAGE`)
- [x] Schema (migration `20260904150000_outcomes`): `calls.outcome` + `calls.next_action`
      (separate columns), `follow_ups`, `relationship_ownership` (partial-unique one active RM
      per customer), `outbound_messages`
- [x] `MessagingProvider` abstraction + registry + mock adapter (`MESSAGING_PROVIDER=mock`),
      mirroring the dialer seam; outbound messages PENDING→SENT/FAILED, failures stored
- [x] `POST /calls/:id/outcome` with the full validation matrix (exactly three outcomes;
      Interested ⇔ exactly one of Callback|Sales; no default; Callback ⇔ date+time+reason;
      one outcome per call; terminal state required). Sales path: close lead + release agent
      ownership + assign RM + enqueue product message composed from crops + guidance
- [x] Follow-ups module: `GET /follow-ups` (agent scoped to own; manager/founder all) +
      `POST /follow-ups/:id/complete`; call context now returns follow-ups + RM owner
- [x] Backend tests green — 66 total (outcomes e2e × 9: matrix rejections, happy paths incl.
      follow-up creation, RM assignment, product message, audit rows; follow-up lifecycle +
      RBAC; regression fixes for assistant suite)
- [x] Workspace UI: record-outcome step with exactly three buttons; two-stage Interested
      (Callback → date/time/reason form; Sales → handoff); outcome + next-action badges in
      call history; RM chip + live follow-ups panel in customer context with Complete action
- [x] Web typecheck + unit tests green; docs aligned (business-rules, database, api,
      architecture, open-items #12, progress)

### Month 3 summary

- Call lifecycle is end-to-end: dial → outcome → follow-up or RM handoff, with no invented
  retry policy and no hard-coded vendors (dialer + messaging both behind config-selected
  internal abstractions). Open items carried: messaging channel/template, follow-up status
  vocabulary + timezone, Not-Answered retry behaviour (open-items.md).

## Month 4 — Relationship Manager ownership workspace (complete)

Goal (PRD §6.4, §11): relationship ownership as a real, distinct RM concept — portfolio
visibility with ownership restrictions, authorised reassignment/release with full audit
history, and the workspace UI (conversion handoff from the Agent workspace landed in Month 3).

### Order of work

- [x] Permissions `relationship.read` (RM workspace) + `relationship.manage` (assign/reassign/
      release) — MANAGER + FOUNDER; seed matrix refreshed
- [x] Backend: `GET /relationship/customers?rmId&q&unassigned=1` (portfolio rows with
      pending-follow-up counts + last call), `GET /relationship/holders` (eligible holders +
      load), `POST /relationship/customers/:id/assign` + `…/release` — append-only ownership
      history + audit (`relationship.assigned/released`); Manager scoped to own portfolio;
      Founder any; assign-to-current-holder idempotent
- [x] Customer notes: `GET/POST /customers/:id/notes` (audited `customer.note_added`), scoped
      by the standard customer visibility
- [x] Seed demo: two converted demo customers under Manager One with notes + pending
      follow-ups (dev DB refreshed)
- [x] Backend tests green — 75 total (relationship e2e × 6: RBAC, Sales→RM handoff, portfolio
      scoping, founder reassign + idempotency + manager 403s, invalid holders, release +
      claim-to-self, customer-note scope/audit; dashboard e2e × 3)
- [x] Web: RM workspace page (`/relationship-manager`) — Portfolio / Unassigned tabs, founder
      RM filter + search, detail panel with profile, ownership reassign/release, follow-ups
      with Complete, customer notes composer, call history with outcome badges; nav gated to
      `relationship.read`
- [x] AI Assistant already global from the feature change (month placeholder removed earlier)

## Month 5 — Dashboard + hardening (complete)

Goal: telecaller dashboard from real CRM data (PRD §6.2) plus the final hardening pass.

### Order of work

- [x] `GET /dashboard/summary` — role-scoped live aggregates: calls today
      (dialed/connected/completed/not-answered), follow-ups (pending/overdue/due-today/
      completed-today), leads (open/closed/new-this-week), customers
      (visible/converted/interested), recent calls; AGENT → `scope: "me"`, MANAGER/FOUNDER →
      `scope: "team"`; staff 403
- [x] Dashboard UI at `/` + `/dashboard` — stat cards, follow-ups-due board with Complete
      (overdue/due-today highlighting), recent-calls activity feed; every number live
- [x] Nav cleaned: month badges removed; Dashboard / Agent / Relationship Manager items now
      permission-gated
- [x] Full verification pass: API 76 tests / 11 files green, web typecheck + 3 unit tests,
      shared typecheck + 11 unit tests
- [x] Docs aligned (permissions, api, architecture, business-rules, database, open-items,
      company-context, progress); live preview verified per role
- [x] Customer profile editing UI (post-completion add-on): add/remove phones, locations and
      crops, make-primary actions and acreage notes directly on the customer detail page
      (backend endpoints already existed; the UI gap is closed — verified live: alternate
      phone + Tomato crop added to a demo farmer)
- [x] Interactive dashboard (post-completion add-on): farmer-pipeline donut (converted / open /
      interested / not-interested / never-reached, all-time, role-scoped) with hover-highlight
      slices and click-to-drill-down farmer lists (code, phone, location, crops → customer
      profile); Today / 7 days / 30 days window control drives the call metrics; backend
      pipeline segmentation is a single SQL pass per role + `GET /dashboard/pipeline`
      drill-down endpoint (e2e: segmentation, drill-down items, range echo, 403s)

### Notes

- No fake/mock metrics anywhere: dashboard numbers are Prisma aggregates over real rows.
- Dev/test infra note: `infra/dev-db.mjs` skips initdb when `.pgdata` is already initialised
  and clears stale `postmaster.pid`; a `serve` command keeps postgres alive detached.

## CRM complete

All five months are implemented and tested: foundation (M1) → agent calling workspace (M2) →
call outcomes + follow-ups + sales progression (M3) → RM ownership workspace + AI Assistant
(M4 + feature change) → dashboard + hardening (M5). Guards respected: exactly three call
outcomes, outcome/next-action always separate, distinct lead vs relationship ownership, one
shared employee identity, RBAC enforced backend-side, providers behind internal abstractions,
no Phase 2/3 modules.
