# GROTEC FarmerOS

An internal operating system for GROTEC Agro Products: a telecalling CRM for farmer outreach, plus an HRMS for
the staff who do it. npm-workspaces monorepo — a NestJS REST API, a React SPA, and a shared package of domain
constants. PostgreSQL runs on Supabase, accessed through Prisma.

Claims are marked by how they were established: **[verified]** confirmed by running it · **[inspected]** read
from the code here · **[unverified]** expected from inspection but never executed.

## Repository layout

| Path | Purpose |
|---|---|
| `backend/` | NestJS REST API under `/api/v1`, Prisma ORM, migrations, seed |
| `frontend/` | React + Vite + Tailwind single-page app |
| `packages/shared/` | Role codes, permission codes, enums, events, phone helpers |
| `infrastructure/` | Standalone utility scripts (currently `scripts/extract-pdf.mjs`) |

There is no `docs/` directory in this repository. **[inspected]**

## Tech stack

**[inspected — versions from the `package.json` files]**

- **Backend** — NestJS 10, Prisma 6, `@nestjs/swagger` 7, `@nestjs/jwt`, `class-validator`. Global prefix
  `/api/v1`; generated API docs at `/api/docs`.
- **Frontend** — React 18, Vite 5, Tailwind 3, React Router 6, TanStack Query 5, axios, react-hook-form, zod.
- **Shared** — TypeScript 5.6, compiled to CommonJS in `packages/shared/dist/` (build output is committed).
- **Tooling** — Vitest 2 in all three workspaces. Node >= 20 required.

## What's implemented

**[inspected — 21 controllers across 18 modules in `backend/src/modules/`, pages in `frontend/src/pages/`]**

**CRM**

- **Farmer master** — generated farmer codes, multiple E.164-normalised phones, locations, crops with acreage,
  notes. Duplicate phones are rejected, returning the matching customer rather than creating a second one.
- **Leads** — creation, assignment, and an append-only ownership history with exactly one current owner.
- **Calling workspace** — outbound calls via a provider abstraction, call notes, per-call history, a status
  webhook plus polling fallback. Only a mock dialer is registered; no telephony vendor is connected.
- **Call outcomes** — exactly three (Interested / Not Interested / Not Answered), Next Action stored separately
  from Outcome. Follow-ups carry scheduled callback dates, surfaced in the dashboard and workspace.
- **Relationship ownership** — long-term farmer ownership, modelled separately from lead ownership.
- **Knowledge Base** — crop → problem-type → recommended-product guidance, plus an assistant chat over the same
  dataset through a configurable LLM provider.
- **Dashboards** — role-scoped: agents see their own workload, managers and founders see the team.

**HRMS**

- **Employees** — profiles, documents, notes, history records, assignments, reporting lines.
- **Attendance** — manual and eSSL biometric punch sources, approval workflow with history, exception flagging.
- **Leave** — leave types with quotas, per-employee balances, applications, approval chain.
- **Payroll** — salary revisions with components, an advance ledger with recovery, and payroll runs following an
  Idle → Generated → Approved/Locked → Published state machine.
- **KPI** — configurable targets and weights, computed period scores, review entries.
- **Notifications** — in-app records for follow-up, attendance, leave and payroll events.

**Platform**

- **Auth** — JWT access tokens; refresh sessions stored hashed and rotated on use; login rate limiting.
- **Authorisation** — five roles (Founder, Manager, Agent, Staff, Delivery) with a rank hierarchy, plus
  fine-grained permission codes enforced by a global guard.
- **Audit** — append-only events recording actor, entity, action, and before/after state.
- **Transactional outbox** — domain events written in the same transaction as the mutation that produced them,
  dispatched by a worker with leases, retries and consumer-side idempotency.
- **Database** — 11 Prisma migrations. Partial unique indexes enforcing "exactly one current owner" live in
  migration SQL, which Prisma's schema language cannot express.

## Configuration

Requires Node.js >= 20 and npm, plus a PostgreSQL database (the project is configured for Supabase). Backend
configuration lives in `backend/.env`. **Create it from the tracked template only if it does not already
exist — never overwrite a `backend/.env` that is already present**, or you will destroy working credentials:

```bash
cp -n backend/.env.example backend/.env                                             # macOS / Linux (-n: no clobber)
```

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }  # Windows PowerShell
```

Then fill in your own values. `backend/.env` is gitignored. Never commit it, and never paste real credentials
into this README, the template, or an issue. The template documents every variable the app reads: Supabase
connection strings, JWT signing secret, cookie and login-rate-limit settings, seed identity, dialer settings,
and the assistant's LLM provider settings. The frontend needs no environment variables in development — it
reaches the API through a Vite dev-server proxy. **[inspected — `frontend/vite.config.ts`]**

## Running locally

```bash
npm install
npm run migrate:dev     # apply Prisma migrations
npm run seed            # roles, permissions, crops, demo employees
npm run dev:api         # API on http://localhost:3000/api/v1 — docs at /api/docs
npm run dev:web         # SPA on http://localhost:5173, proxying /api to port 3000
```

**[unverified]** These are read from the `package.json` scripts and the Vite config; they were not executed
while writing this document. Read **Known issues** before running `dev:web`.

## Running with Docker

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

**[inspected]** The backend image is a multi-stage `node:20-alpine` build that generates the Prisma client,
listens on 3000, exposes a healthcheck against `/api/v1/health`, and reads `backend/.env` via `env_file`. The
frontend image builds the Vite bundle and serves it from `nginx:alpine`, reverse-proxying `/api/` to the backend
container and falling back to `index.html` for client-side routes. The frontend service waits for the backend
healthcheck to pass.

**[unverified]** The stack has not been built or run here, and the frontend image build depends on the same
bundling step noted under Known issues.

## Testing

```bash
npm run test        # shared + backend + frontend
npm run test:api    # backend only
npm run test:web    # frontend only
```

> ### ⚠️ `TEST_DATABASE_URL` is destructive
>
> Backend global setup runs `prisma db push --force-reset` against whatever `TEST_DATABASE_URL` points at.
> **That wipes the database.** Use only a dedicated, disposable test database — **never the application's real
> Supabase database.** The variable is also mandatory: global setup throws if it is unset, which blocks the
> entire backend suite, including tests that need no database at all.
> **[inspected — `backend/test/global-setup.js`]**

**Isolated tests, no database required.** `backend/vitest.step1.config.js` runs the CORS and health-check
regression specs with no global setup. From `backend/`:

```bash
npm.cmd exec vitest -- run --config vitest.step1.config.js   # Windows
npx vitest run --config vitest.step1.config.js               # macOS / Linux
```

**[verified]** 17 of 17 passing on Windows. This config is reachable only through an explicit `--config` flag,
so it never affects `npm test`. The full backend e2e suite is **[unverified]** — it has not been executed, for
want of a disposable test database.

## Seeded demo accounts

`npm run seed` creates a founder plus four demo employees, one per remaining role
**[inspected — `backend/prisma/seed.js`]**:

| Email | Role |
|---|---|
| `founder@grotec.local` | Founder |
| `manager@grotec.local` | Manager / Admin |
| `agent@grotec.local` | Telecaller / Agent |
| `staff@grotec.local` | Office & HR Staff |
| `delivery@grotec.local` | Delivery & Field Specialist |

The founder's email and the password used for the seeded accounts come from `FOUNDER_EMAIL` and
`FOUNDER_PASSWORD` in `backend/.env`; additional employees can be added via `SEED_EMPLOYEES`. These are local
development accounts — change the credentials before any shared or public deployment.

## Scope and current state

Both the CRM and HRMS modules above are implemented in this repository. Earlier revisions of this README
described HRMS and payroll as out of scope; that statement was inaccurate and has been removed.

The governing product documents (the Phase 1 PRD and the Developer Requirement Brief) are **not present in this
repository** and are not tracked by git. Settle scope questions against those documents directly, not against
this README.

External integrations are architected but not connected: the auto-dialer and the messaging provider both sit
behind internal abstractions with only mock implementations registered. There is no call-recording capability
and no deployed environment. Continuous Integration is configured in `.github/workflows/ci.yml` validating
builds, typechecks, and database-independent unit test suites across all workspaces. **[inspected]**

## Known issues

- **Frontend shared-package alias.** `frontend/vite.config.ts` aliases `@grotec/shared` to
  `packages/shared/src/index.ts`, but that directory holds `.js` sources and no `index.ts`. Two frontend files
  import runtime values (not only types) from that package, so the alias needs to resolve. This was identified
  by **static inspection only** — frontend dev, build and Docker image success have **not** been runtime-verified
  either way, so treat it as a lead to check rather than a confirmed failure. The backend is unaffected; it
  resolves the shared package through its committed `dist/` build.
- **`npm run lint` is a no-op.** The root script delegates with `--workspaces --if-present`, no workspace defines
  a `lint` script, and there is no ESLint configuration anywhere. It exits successfully without checking anything.
  **[inspected]**
- **Full e2e execution needs a dedicated database.** See the warning under Testing; until a disposable
  `TEST_DATABASE_URL` exists, only the isolated config above can run.
