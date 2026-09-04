# Permissions

_Last updated: Month 1. **PROVISIONAL** — the PRD v2.1 permission matrix must be reviewed before
release; corrections are data-only (seed update), not code changes._

## Roles (Phase 1 login roles only)

- `FOUNDER` — Founder
- `MANAGER` — Manager/Admin
- `AGENT` — Telecaller/Agent
- `STAFF` — Staff

Relationship Manager is an **ownership concept**, not a login role. RM ownership (Month 4)
is assigned to an employee regardless of role, per the PRD.

## Permission codes

| Code | Meaning |
|---|---|
| `employee.read` / `employee.create` / `employee.update` / `employee.deactivate` / `employee.reset_password` | Identity management |
| `role.read` / `permission.read` | Read roles/permissions |
| `customer.read` / `customer.create` / `customer.update` / `customer.deactivate` | Farmer master |
| `crop.read` / `crop.manage` | Crop catalog |
| `lead.read` / `lead.create` / `lead.update` / `lead.assign` | Leads + ownership assignment |
| `audit.read` | Audit log |

## Proposed seed matrix (provisional)

| Permission | FOUNDER | MANAGER | AGENT | STAFF |
|---|---|---|---|---|
| employee.read | ✅ | ✅ | — | — |
| employee.create / update | ✅ | ✅ | — | — |
| employee.deactivate / reset_password | ✅ | — | — | — |
| customer.read / create / update | ✅ | ✅ | ✅ (scoped) | ✅ (read) |
| customer.deactivate | ✅ | ✅ | — | — |
| crop.read | ✅ | ✅ | ✅ | ✅ |
| crop.manage | ✅ | ✅ | — | — |
| lead.read / create / update | ✅ | ✅ | ✅ (own) | — |
| lead.assign | ✅ | ✅ | — | — |
| audit.read | ✅ | ✅ | — | — |

AGENT scope: customers/leads they created or currently own. STAFF scope: read-only (provisional).
