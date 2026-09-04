# API

_Last updated: Month 5. Base path `/api/v1`. Interactive docs served by the API at
`/api/docs` (Swagger/OpenAPI). All routes require a valid access token unless marked public._

## Error envelope

```json
{ "error": { "code": "CUSTOMER_PHONE_EXISTS", "message": "…", "details": {}, "matchedCustomer": { "id": "…", "fullName": "…" } } }
```

## Endpoints (Month 1)

| Module | Method + Path | Access (provisional — see `permissions.md`) |
|---|---|---|
| Health | `GET /health` | public |
| Auth | `POST /auth/login` · `POST /auth/refresh` | public |
| Auth | `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` | authenticated |
| Employees | `GET /employees` · `POST /employees` · `GET/PATCH /employees/:id` · `POST /employees/:id/activate` · `…/deactivate` · `…/reset-password` | FOUNDER (MANAGER per matrix ⚠) |
| Roles | `GET /roles` · `GET /permissions` | authenticated |
| Customers | `GET /customers?q&phone&status&cropId&ownerId&page&size` · `POST /customers` (409 on duplicate phone) · `GET /customers/:id` · `PATCH /customers/:id` · `GET /customers/lookup?phone=` | scoped |
| Customer parts | `POST /customers/:id/phones` · `PATCH /customers/:id/phones/:phoneId` · `DELETE …/phones/:phoneId` · `POST /customers/:id/locations` · `PATCH/DELETE …/locations/:locationId` · `POST /customers/:id/crops` · `DELETE …/crops/:customerCropId` | scoped |
| Crops | `GET /crops` | authenticated |
| Crops | `POST /crops` · `PATCH /crops/:id` (activate/deactivate/edit) | MANAGER/FOUNDER ⚠ |
| Leads | `GET /leads?status&owner&q&page` · `POST /leads` · `GET /leads/:id` · `PATCH /leads/:id` · `GET /leads/:id/ownership-history` | scoped (AGENT: own) |
| Leads | `POST /leads/:id/assign` | FOUNDER/MANAGER (rules ⚠) |
| Calls | `POST /calls` (auto-dial; resolves phone → customer; 409 `ACTIVE_CALL_EXISTS` while one call is live) · `GET /calls/queue?ownerId` (agent's calling workload) · `GET /calls/:id` (triggers provider status sync) · `GET /calls/:id/context` (call + customer profile + history) | AGENT (own calls/queue); MANAGER/FOUNDER (all, `ownerId` filter) |
| Calls | `POST /calls/:id/end` · `POST /calls/:id/notes` | AGENT (own call) / MANAGER / FOUNDER |
| Outcome | `POST /calls/:id/outcome` (body `{ outcome, nextAction?, followUpDate?, followUpTime?, followUpNote? }`) — validates the Month 3 matrix (exactly three outcomes; Interested ⇔ exactly one of Callback\|Sales; Callback ⇔ date+time+reason; terminal call state required; one outcome per call) and creates follow-ups / RM ownership + product message on Sales | `call.manage` (AGENT own call) |
| Follow-ups | `GET /follow-ups?customerId&status&ownerId` · `POST /follow-ups/:id/complete` | `call.read` (AGENT: own) / `call.manage` on complete (AGENT: own) |
| Call history | `GET /customers/:id/calls` | `call.read` + customer scope |
| Dialer webhooks | `POST /dialer/webhooks/:provider` (body: `{ providerCallId, status, … }`; header `x-webhook-secret`) | public, secret-guarded (vendor status pushes) |
| Assistant | `POST /assistant/chat` (body `{ message, customerId?, cropId?, conversationId? }`) — retrieves crop-product guidance, calls the LLM with it + Grotec company context, audits the Q&A | `assistant.use` (FOUNDER/MANAGER/AGENT) |
| Assistant | `GET /assistant/guidance?cropId&q&includeInactive` · `POST /assistant/guidance` · `PATCH /assistant/guidance/:id` | `assistant.manage` (FOUNDER/MANAGER) |
| Relationship | `GET /relationship/customers?rmId&q&unassigned=1` (portfolio; `unassigned=1` lists converted customers with no RM) · `GET /relationship/holders` (eligible RM holders + load) | `relationship.read` (FOUNDER/MANAGER; MANAGER scoped to own portfolio) |
| Relationship | `POST /relationship/customers/:customerId/assign` `{ employeeId, reason? }` · `POST /relationship/customers/:customerId/release` `{ reason? }` (audited; one active RM per customer) | `relationship.manage` (FOUNDER any; MANAGER own portfolio / claim-to-self) |
| Customer notes | `GET /customers/:id/notes` · `POST /customers/:id/notes` `{ body }` (audited `customer.note_added`) | `customer.read` / `customer.update` + customer scope |
| Dashboard | `GET /dashboard/summary` — role-scoped metrics from real data: calls today (dialed/connected/completed/not-answered), follow-ups (pending/overdue/due-today/completed-today), leads (open/closed/new-this-week), customers (visible/converted/interested), recent calls | `call.read` (AGENT = own workload, `scope: "me"`; MANAGER/FOUNDER = team) |
| Audit | `GET /audit?entityType&entityId&actorId&action&from&to&page` | FOUNDER only (PRD §5.2) |

List responses: `{ items: [], total, page, pageSize }`; `GET /calls/queue` returns an array.

## Call record shape (Month 2/3)

`id`, `customerId?`, `leadId?`, `agentId`, `phoneNumber` (canonical E.164, captured at dial),
`direction` (`OUTBOUND`), `status` (`DIALING|RINGING|CONNECTED|ENDED|NOT_ANSWERED|FAILED`),
`provider` + `providerCallId` (integration seam), `connectedAt?`, `startedAt`, `endedAt?`,
`disconnectReason?`, `notes[]` (with author), and — once recorded — `outcome`
(`INTERESTED|NOT_INTERESTED|NOT_ANSWERED`) and `nextAction` (`CALLBACK|SALES`) as **separate**
fields (PRD §11.1). Queue items add `customer` (farmer code, name, primary phone, crops+acreage)
and `lastCall` per lead.

## Outcome / follow-up / handoff shape (Month 3)

- `POST /calls/:id/outcome` returns `{ call, followUp, relationshipOwner, message }`:
  `followUp` present for Interested→Callback (with `dueAt`, `note`, `status: PENDING`);
  `relationshipOwner` + `message` present for Interested→Sales (auto-assigned RM from
  `RELATIONSHIP_MANAGER_EMAIL`, `outbound_messages` row enqueued via the mock messaging
  provider). Sales also closes the lead and releases the agent's lead ownership.
- Follow-up record shape: `id`, `customer`, `agent`, `dueAt` (date+time combined), `note`,
  `status` (`PENDING|COMPLETED|CANCELLED` — provisional vocabulary), `completedAt?`.
- `GET /calls/:id/context` now also returns `followUps` (customer's follow-ups) and
  `relationshipOwner` (active RM), so the workspace can show both.

## Relationship (RM) workspace shape (Month 4)

- `GET /relationship/customers` → `{ items: [...] }`, one row per active ownership with
  `customer` (id, farmerCode, fullName, primaryPhone, location, crops+acreage), `owner`,
  `assignedAt`, `reason`, `convertedAt`, `pendingFollowUps`, `lastCall` (status/outcome).
  `?unassigned=1` rows have `owner: null`. `GET /relationship/holders` returns ACTIVE
  Manager-role employees with their current customer count for pickers.
- `POST …/assign` and `…/release` write append-only `relationship_ownership` history and
  audit `relationship.assigned` / `relationship.released` with the actor, previous holder and
  reason. Assign to the current holder is an idempotent no-op.
- RM panel endpoints reuse the standard shapes: `GET /customers/:id`, `GET /customers/:id/notes`,
  `GET /customers/:id/calls`, `GET /follow-ups?customerId=`.

## Dashboard summary shape (Month 5)

`GET /dashboard/summary` → `{ scope: "me"|"team", calls: { dialedToday, connectedToday,
completedToday, notAnsweredToday }, followUps: { pending, overdue, dueToday,
completedToday }, leads: { open, closedTotal, newThisWeek }, customers: { total, converted,
interested }, recentActivity: [...] }`. “Connected” counts calls that ended after connecting
(agent-completed conversations); `converted` counts customers with an active RM row
(team) or farmers the agent moved to Sales (agent); every number is a live aggregate — no
mock metrics.

## Assistant chat shape (replaces the Knowledge Base screen)

`POST /assistant/chat` answers with `{ status, conversationId, answer, sources }`:
- `status`: `answered` (LLM answer) or `unavailable` (no `LLM_API_KEY` configured, network
  failure, provider error — never a crash).
- `sources`: the `crop_product_guidance` rows retrieved for the message (crop name,
  problem keywords, recommended Grotec products, usage guidance). The agent workspace
  auto-passes the active call's `customerId` + first `cropId` so mid-call questions carry
  context; farmers can also be looked up server-side from `customerId`.
- LLM access sits behind the internal `ASSISTANT_LLM_PROVIDER` token (OpenAI-compatible
  adapter by default; configurable via `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`).
- Every question+answer is recorded in the audit log (`assistant.chat`).

## Scope rules (backend-enforced)

- `customer.read` for AGENT returns only customers the agent created or holds a current lead on.
- MANAGER/FOUNDER see all customers; STAFF has no CRM endpoints in Phase 1 (PRD §5.2).
- Ownership checks run in the service layer, never only in the UI.

## Customer record shape (Month 1)

`id`, `farmerCode` (unique Farmer ID, `GF`+8 digits), `fullName`, `status`, `createdBy`,
`phones[]` (canonical E.164 + `isPrimary` — alternate numbers are additional rows),
`locations[]` (addressLine, village, **taluk**, district, state, pincode, geo),
`crops[]` (crop + `acreage` + unit), `leads[]` (with `currentOwner`).
`preferredLanguage` is reserved; vocabulary open.
