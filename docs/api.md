# API

_Last updated: Month 2 + AI Assistant feature change. Base path `/api/v1`. Interactive docs
served by the API at `/api/docs` (Swagger/OpenAPI). All routes require a valid access token
unless marked public._

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
| Call history | `GET /customers/:id/calls` | `call.read` + customer scope |
| Dialer webhooks | `POST /dialer/webhooks/:provider` (body: `{ providerCallId, status, … }`; header `x-webhook-secret`) | public, secret-guarded (vendor status pushes) |
| Assistant | `POST /assistant/chat` (body `{ message, customerId?, cropId?, conversationId? }`) — retrieves crop-product guidance, calls the LLM with it + Grotec company context, audits the Q&A | `assistant.use` (FOUNDER/MANAGER/AGENT) |
| Assistant | `GET /assistant/guidance?cropId&q&includeInactive` · `POST /assistant/guidance` · `PATCH /assistant/guidance/:id` | `assistant.manage` (FOUNDER/MANAGER) |
| Audit | `GET /audit?entityType&entityId&actorId&action&from&to&page` | FOUNDER only (PRD §5.2) |

List responses: `{ items: [], total, page, pageSize }`; `GET /calls/queue` returns an array.

## Call record shape (Month 2)

`id`, `customerId?`, `leadId?`, `agentId`, `phoneNumber` (canonical E.164, captured at dial),
`direction` (`OUTBOUND`), `status` (`DIALING|RINGING|CONNECTED|ENDED|NOT_ANSWERED|FAILED`),
`provider` + `providerCallId` (integration seam), `connectedAt?`, `startedAt`, `endedAt?`,
`disconnectReason?`, `notes[]` (with author). Queue items add `customer` (farmer code, name,
primary phone, crops+acreage) and `lastCall` per lead.

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
