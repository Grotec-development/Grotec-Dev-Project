# Permissions

_Last updated: Month 4 — aligned with PRD v2.1 §5.2 (docs/reference/prd-v2.1.md)._

Relationship Manager ownership (`relationship.read`/`relationship.manage`) was added when
the RM workspace shipped (Month 4).

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
| `call.read` / `call.manage` | Calling workspace: queue, dial, end, notes, record outcome |
| `relationship.read` | RM workspace — customers under relationship ownership (Manager: own portfolio; Founder: all) |
| `relationship.manage` | Assign / reassign / release RM ownership (Manager: own portfolio; Founder: any) |
| `assistant.use` | AI Assistant chat + Knowledge Base browse/search (question → retrieved guidance → answer; every Q&A audited) |
| `assistant.manage` | Knowledge Base content management — create/edit/retire `crop_product_guidance` rows (incl. listing retired rows) |
| `audit.read` | Complete audit logs (Founder-only) |

## Role → permission seed matrix

PRD §5.2 rows mapped to codes. Two §5.2 open items remain (Staff boundaries; exact
Founder-restricted boundary) — see `open-items.md`.

| PRD §5.2 capability | Founder | Manager | Agent | Staff |
|---|---|---|---|---|
| CRM — Dashboard | yes | yes | yes (own workload) | no |
| CRM — Agent calling workspace | yes | yes | yes (own calls) | no |
| CRM — Relationship Manager workspace | yes | yes | no | no |
| CRM — All customer records | yes | yes | **assigned only** (service-level scope) | no |
| CRM — Knowledge Base browse + AI Assistant (chat) | yes | yes | yes | no |
| CRM — Knowledge Base content mgmt | yes | yes | no | no |
| Audit logs / security settings | **yes** | no | no | no |
| System administration | yes | no | no | no |

### Enforcement notes

- **Backend-only.** A global `AuthGuard` validates the access token; `@RequirePermission`
  gates every handler; `PermissionGuard` rejects missing permissions (UI checks are
  supplementary).
- **Knowledge Base + AI Assistant permissions.** `assistant.use` gates `POST /assistant/chat`
  **and** `GET /assistant/guidance` — telecallers browse/search active rows on the Knowledge
  Base page and reach the same guidance read-only through the chat. `assistant.manage` gates
  guidance content management (`POST/PATCH /assistant/guidance`, plus `includeInactive` on
  the list) — Founder/Manager only.
- **Relationship ownership scoping.** `relationship.read` list is scoped to the Manager's own
  active portfolio (a Manager cannot view or filter another RM's customers — 403); the
  Founder sees all with an optional `rmId` filter. `relationship.manage` lets a Manager
  transfer customers **in their own portfolio** or claim an unassigned converted customer to
  themselves; only the Founder can move other RM portfolios or release anyone's ownership.
  Eligible RM holders are ACTIVE Manager-role employees (provisional rule — see
  `open-items.md`).
- **Record scoping in services.** `AGENT` customer reads resolve to customers they created
  or currently own a lead on (`lead_ownership.released_at IS NULL`); `AGENT` lead reads to
  leads they currently own. Manager/Founder see all records.
- `STAFF` is seeded with no CRM permissions until HRMS ships.
- Founder-role assignment and employee deactivation/reset are restricted to the Founder.
