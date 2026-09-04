# Permissions

_Last updated: Month 1 — aligned with PRD v2.1 §5.2 (docs/reference/prd-v2.1.md)._

## Roles (Phase 1 login roles only, PRD §5.1)

- `FOUNDER` — Founder
- `MANAGER` — Manager/Admin
- `AGENT` — Telecaller/Agent
- `STAFF` — Staff (HRMS/payroll-oriented; **no CRM capability in Phase 1** per the §5.2 matrix)

Additional organisational roles arrive as login roles only when their workflow ships (§5.1).
Relationship Manager is an ownership concept, not a login role (§6.4; open item on becoming one).

## Permission codes (CRM foundation)

| Code | Meaning |
|---|---|
| `employee.read` / `employee.create` / `employee.update` | Identity management (operational) |
| `employee.deactivate` / `employee.reset_password` | Founder-only security controls |
| `customer.read` / `customer.create` / `customer.update` / `customer.deactivate` | Farmer master |
| `crop.read` / `crop.manage` | Crop catalog (crop-product guidance prelude, §6.5) |
| `lead.read` / `lead.create` / `lead.update` / `lead.assign` | Leads + ownership assignment |
| `assistant.use` | AI Assistant chat (question → retrieved guidance → answer; every Q&A audited) |
| `assistant.manage` | Crop-product guidance content management (create/edit/list rows) |
| `audit.read` | Complete audit logs (Founder-only) |

## Role → permission seed matrix

PRD §5.2 rows mapped to codes. Two §5.2 open items remain (Staff boundaries; exact
Founder-restricted boundary) — see `open-items.md`.

| PRD §5.2 capability | Founder | Manager | Agent | Staff |
|---|---|---|---|---|
| CRM — Dashboard / Agent / RM | yes | yes | yes (own workload) | no |
| CRM — All customer records | yes | yes | **assigned only** (service-level scope) | no |
| CRM — AI Assistant (chat) | yes | yes | yes | no |
| CRM — AI Assistant content mgmt | yes | yes | no | no |
| Audit logs / security settings | **yes** | no | no | no |
| System administration | yes | no | no | no |

### Enforcement notes

- **Backend-only.** A global `AuthGuard` validates the access token; `@RequirePermission`
  gates every handler; `PermissionGuard` rejects missing permissions (UI checks are
  supplementary).
- **AI Assistant permissions.** `assistant.use` gates `POST /assistant/chat` (Agents/telecallers
  reach guidance read-only through the chat). `assistant.manage` gates guidance content
  management (`GET/POST/PATCH /assistant/guidance`) — Founder/Manager only.
- **Record scoping in services.** `AGENT` customer reads resolve to customers they created
  or currently own a lead on (`lead_ownership.released_at IS NULL`); `AGENT` lead reads to
  leads they currently own. Manager/Founder see all records.
- `STAFF` is seeded with no CRM permissions until HRMS ships.
- Founder-role assignment and employee deactivation/reset are restricted to the Founder.
