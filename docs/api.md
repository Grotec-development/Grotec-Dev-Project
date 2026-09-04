# API

_Last updated: Month 1. Base path `/api/v1`. Interactive docs served by the API at `/api/docs`
(Swagger/OpenAPI). All routes require a valid access token unless marked public._

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
| Audit | `GET /audit?entityType&entityId&actorId&action&from&to&page` | FOUNDER only (PRD §5.2) |

List responses: `{ items: [], total, page, pageSize }`.

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
