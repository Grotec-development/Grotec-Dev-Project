# GROTEC FarmerOS — CRM

CRM for GROTEC FarmerOS, built incrementally over five months per the approved plan:

- **Month 1 — CRM Foundation** (in progress): identity, RBAC, customer/farmer master, phone
  normalization + duplicate prevention, crops/acreage, leads + lead ownership, audit,
  API foundation, responsive UI shell.
- Month 2 — Agent Calling Workspace (auto-dialer behind an internal abstraction).
- Month 3 — Call outcomes (Interested / Not Interested / Not Answered), follow-ups, sales progression.
- Month 4 — Relationship Manager ownership + Knowledge Base (browse/manage) + AI Assistant (chat).
- Month 5 — Telecaller dashboard, reporting, hardening, E2E.

**Scope guardrails:** no HRMS/payroll/inventory/accounting/sales-transactions in this project.
Future modules extend this schema; identity, ownership, and audit are shared infrastructure.

## Layout

| Path | Purpose |
|---|---|
| `apps/api` | NestJS REST API (`/api/v1`), Prisma ORM |
| `apps/web` | React + Vite + Tailwind SPA |
| `packages/shared` | Domain constants / enums / permission codes shared by both apps |
| `docs/` | Living documentation (architecture, database, API, permissions, business rules, open items, progress) |
| `infra/` | Docker Compose (Postgres 16) + embedded-Postgres dev fallback script |

## Quick start

Prerequisites: Node >= 20 and npm. PostgreSQL can be provided either way:

- **Docker (recommended for day-to-day dev):** `docker compose -f infra/docker-compose.yml up -d`
- **No Docker (fallback):** `npm run db:start` — runs a real embedded PostgreSQL in `.pgdata/` (git-ignored)

Then:

```bash
npm install
cp .env.example .env            # root env template; app-specific .env.example files also exist
npm run db:start                # only when not using Docker
npm run migrate:dev             # apply Prisma migrations
npm run seed                    # roles/permissions/crops + demo users
npm run dev:api                 # API on http://localhost:3000  (docs at /api/docs)
npm run dev:web                 # web on http://localhost:5173  (proxies /api)
```

Demo login (dev only): `founder@grotec.local` — password from `apps/api/.env`
(`FOUNDER_PASSWORD`, default `Founder@123`). Other seeded users: `manager@grotec.local`,
`agent@grotec.local`, `staff@grotec.local` (same default password).

## Testing

```bash
npm run test        # shared + API unit/integration + web unit
npm run test:api
npm run test:web
```

Integration/API tests run against a real PostgreSQL (`grotec_test` DB), never a mock.

## Documentation

See `docs/`. The PRD v2.1 and the Developer Requirement Brief belong in `docs/reference/`.
Anything seeded/implemented before those files are reviewed is flagged as **provisional** in
`docs/open-items.md` and `docs/permissions.md`.

Real company/product data (Grotec Agro Products, its product lines, roles) lives in
`docs/company-context.md` — use it instead of placeholder text in seed data, templates, and copy.
