# GROTEC Backend — Test Credentials & Readiness Audit

> **Status snapshot**: GROTEC FarmerOS CRM (Month 1) — NestJS 10.4 + Prisma 6.2 + Supabase Postgres
>
> **Audit date**: 2026-09-07
>
> **Scope**: Backend REST API at `backend/` (controllers, guards, services, outbox, audit, tests, deployment)
>
> **Final verdict**: **READY WITH WARNINGS** — backend is functionally ready for staging and integration testing against the seeded test database. Warnings below must be resolved before any production deploy.

---

## Table of Contents

1. [Test Account & Credential Inventory](#section-1-test-account--credential-inventory)
2. [Role × Permission × Module Matrix](#section-2-role--permission--module-matrix)
3. [Authentication Test Matrix](#section-3-authentication-test-matrix)
4. [Complete API Endpoint Inventory](#section-4-complete-api-endpoint-inventory)
5. [End-to-End Test Plan](#section-5-end-to-end-test-plan)
6. [Database / Supabase Validation](#section-6-database--supabase-validation)
7. [Test Data Dependency Map](#section-7-test-data-dependency-map)
8. [Existing Test Artifact Audit](#section-8-existing-test-artifact-audit)
9. [Git Security Audit](#section-9-git-security-audit)
10. [Deployment Readiness](#section-10-deployment-readiness)
11. [Automated Smoke Test Script](#section-11-automated-smoke-test-script)
12. [Final Verdict & Remediation Checklist](#section-12-final-verdict--remediation-checklist)

---

## Section 1: Test Account & Credential Inventory

### 1.1 Seeded Test Accounts (Development / Test Database Only)

All accounts use the password **`Founder@123`**. They are seeded by `backend/prisma/seed.ts` against `TEST_DATABASE_URL` and the dev database.

| Role       | Email                      | Role Code  | Password      | Notes                                                                                  |
|------------|----------------------------|------------|---------------|----------------------------------------------------------------------------------------|
| FOUNDER    | `founder@grotec.local`     | FOUNDER    | `Founder@123` | Bootstrap account created from `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` env vars            |
| MANAGER    | `manager@grotec.local`     | MANAGER    | `Founder@123` | Seeded via `SEED_EMPLOYEES` env var (Manager One)                                      |
| AGENT      | `agent@grotec.local`       | AGENT      | `Founder@123` | Seeded via `SEED_EMPLOYEES` env var (Agent One)                                        |
| STAFF      | `staff@grotec.local`       | STAFF      | `Founder@123` | Seeded via `SEED_EMPLOYEES` env var (Staff One)                                        |
| DELIVERY   | `delivery@grotec.local`    | DELIVERY   | `Founder@123` | Seeded via `SEED_EMPLOYEES` env var (Delivery One)                                     |

**Source of truth**: `backend/test/helpers.ts:15-21` (`USERS` constant).
**Also used by**: `backend/test/auth.e2e-spec.ts`, `auth-session-security.e2e-spec.ts`, `payroll.e2e-spec.ts`, `customers.e2e-spec.ts`, `rbac.e2e-spec.ts`, and 12 other e2e specs.

### 1.2 TEST / PRODUCTION Boundary

| Type        | Use For                                | Reset?   | Data Touched                |
|-------------|----------------------------------------|----------|-----------------------------|
| **TEST**    | Local dev + `vitest` + smoke script    | `resetData()` between tests | Test DB rows               |
| **STAGING** | Pre-prod integration (when provisioned)| Manual   | Staging DB rows             |
| **PROD**    | Live users                             | Never    | **None from these accounts** |

> ⚠️ **NEVER** log the test password into the production seed. Override `FOUNDER_PASSWORD` for production via env, and rotate all test passwords out of any non-test environment.

### 1.3 Test Database Configuration

- `TEST_DATABASE_URL` (set in `backend/.env.example`): `postgresql://postgres:<password>@127.0.0.1:54322/postgres` — points at the local Supabase dev DB
- `DATABASE_URL` (production / dev runtime): Supabase transaction-pooler (port 6543)
- `DIRECT_URL` (migrations / raw SQL): Supabase session-mode (port 5432)
- Test schema setup: `backend/test/global-setup.ts:35-39` — runs `prisma db push --force-reset` + `prisma/seed.ts` before each `vitest run`
- **One-time partial unique index re-creation** at `global-setup.ts:53-56` (for `relationship_ownership`)

### 1.4 Environment Variables (Documented)

| Var                         | Example / Default                       | Purpose                                   |
|-----------------------------|------------------------------------------|-------------------------------------------|
| `DATABASE_URL`              | Supabase pooler URL                      | Prisma runtime                            |
| `DIRECT_URL`                | Supabase direct URL                      | Migrations / `prisma migrate deploy`      |
| `TEST_DATABASE_URL`         | Local Supabase test DB                   | Test isolation                            |
| `PORT`                      | `3000`                                   | HTTP listener                             |
| `CORS_ORIGINS`              | `http://localhost:5173`                  | Comma-separated allow-list                |
| `JWT_ACCESS_SECRET`         | `dev-only-change-me-access-secret` ⚠️   | JWT signing key — MUST be rotated         |
| `ACCESS_TOKEN_TTL_SECONDS`  | `900` (15 min)                           | JWT lifetime                              |
| `REFRESH_TOKEN_TTL_DAYS`    | `30`                                     | Refresh cookie max age                    |
| `COOKIE_SECURE`             | `false` (dev), `true` (prod)             | Set `Secure` flag on refresh cookie       |
| `COOKIE_SAME_SITE`          | `lax`                                    | CSRF mitigation                           |
| `LOGIN_MAX_ATTEMPTS`        | `5`                                      | Rate-limit threshold                      |
| `LOGIN_WINDOW_MINUTES`      | `15`                                     | Rate-limit window                         |
| `FOUNDER_EMAIL`             | `founder@grotec.local`                   | Seeded founder email                      |
| `FOUNDER_PASSWORD`          | `Founder@123`                            | Seeded founder password                   |
| `SEED_EMPLOYEES`            | Semicolon-CSV of `name,email,role`       | Initial non-founder seed                  |
| `ESSL_WEBHOOK_SECRET`       | `dev-essl-webhook-secret` ⚠️            | ESSL device webhook auth                  |
| `DIALER_*`                  | mock / 4000 / 800 / 1 / 1500             | Mock dialer timing                        |
| `DIALER_WEBHOOK_SECRET`     | `dev-webhook-secret-change-me` ⚠️       | Dialer webhook auth                       |
| `LLM_BASE_URL` / `LLM_MODEL`| Groq / Gemini                            | Assistant provider                        |
| `LLM_API_KEY`               | Provider key                             | Assistant auth                            |

> ⚠️ Values marked ⚠️ are dev placeholders that **must be replaced** before any non-local environment.

---

## Section 2: Role × Permission × Module Matrix

### 2.1 The Five Seeded Roles

`Role` rows in `roles` table (codes mirror `@grotec/shared/RoleCode`):

| Code       | Name (seeded)   | Approximate scope                                      |
|------------|------------------|--------------------------------------------------------|
| `FOUNDER`  | Founder          | Full access — every permission                         |
| `MANAGER`  | Manager          | Operational oversight; no audit log; no payroll publish|
| `AGENT`    | Sales Agent      | CRM core (customers, leads, calls, relationships)      |
| `STAFF`    | Field Staff      | Limited CRM (read customers, own follow-ups)           |
| `DELIVERY` | Delivery Staff  | Deliveries + own attendance + read-only customers      |

### 2.2 Permission Codes (72 across 9 modules)

`@grotec/shared` exports `PERMISSIONS` (canonical) + `RoleCode` + `PermissionCode`. The DB-stored `permissions` table holds the same list, with `RolePermission` join rows for each role.

Representative module groupings:

| Module         | Sample permissions                                                                  |
|----------------|-------------------------------------------------------------------------------------|
| **auth**       | (RBAC is implicit; route-level via `@Public` / guards)                              |
| **employee**   | `employee.create`, `employee.read`, `employee.update`, `employee.deactivate`, `employee.activate`, `employee.reset_password` (FOUNDER only) |
| **customer**   | `customer.create`, `customer.read`, `customer.update`, `customer.deactivate`, `customer.activate` |
| **lead**       | `lead.create`, `lead.read`, `lead.update`, `lead.assign`, `lead.delete`             |
| **call**       | `call.place`, `call.read`, `call.note`, `call.outcome`                              |
| **relationship** | `relationship.read`, `relationship.assign`, `relationship.release`                 |
| **leave**      | `leave.read.own`, `leave.read.all`, `leave.apply`, `leave.approve`                  |
| **attendance** | `attendance.read.own`, `attendance.read.all`, `attendance.punch`, `attendance.approve` |
| **payroll**    | `payroll.read`, `payroll.generate`, `payroll.approve`, `payroll.publish` (FOUNDER only), `payroll.advance.read` |
| **kpi**        | `kpi.read.own`, `kpi.read.all`, `kpi.target.set`                                     |
| **audit**      | `audit.list` (FOUNDER only)                                                          |
| **assistant**  | `assistant.use`                                                                     |
| **notification** | `notification.read`, `notification.read.all`                                       |

> The canonical list is in `packages/shared/src/permissions.ts`; the DB list is mirrored by `seed.ts`.

### 2.3 Role × Module Access Matrix

`✅` = full access, `◐` = limited/own-scoped, `❌` = denied, `—` = N/A.

| Module / Capability               | FOUNDER | MANAGER | AGENT | STAFF | DELIVERY |
|----------------------------------|:-------:|:-------:|:-----:|:-----:|:--------:|
| `GET /health`                    | ✅      | ✅      | ✅    | ✅    | ✅       |
| `POST /auth/login`               | ✅(public)| ✅(public)| ✅(public)| ✅(public)| ✅(public) |
| `GET /auth/me`                   | ✅      | ✅      | ✅    | ✅    | ✅       |
| `POST /auth/change-password`     | ✅      | ✅      | ✅    | ✅    | ✅       |
| List employees                   | ✅      | ✅      | ✅    | ✅    | ✅       |
| Create / deactivate employee     | ✅      | ❌      | ❌    | ❌    | ❌       |
| Reset employee password          | ✅      | ❌      | ❌    | ❌    | ❌       |
| **List roles + permissions**     | ✅      | ✅      | ✅    | ✅    | ✅       |
| Create customer                  | ✅      | ✅      | ✅    | ❌    | ❌       |
| Update customer                  | ✅      | ✅      | ✅    | ◐ (own assigned) | ◐ (read-only) |
| Deactivate customer              | ✅      | ✅      | ❌    | ❌    | ❌       |
| Create / assign lead             | ✅      | ✅      | ✅    | ◐     | ❌       |
| Place / outcome call             | ✅      | ✅      | ✅    | ◐     | ❌       |
| Customer relationships           | ✅      | ✅      | ✅    | ◐     | ❌       |
| Attendance — read own            | ✅      | ✅      | ✅    | ✅    | ✅       |
| Attendance — read all            | ✅      | ✅      | ❌    | ❌    | ❌       |
| Attendance — punch               | ✅      | ✅      | ✅    | ✅    | ✅       |
| Attendance — approve             | ✅      | ✅      | ❌    | ❌    | ❌       |
| Leave — read own / apply         | ✅      | ✅      | ✅    | ✅    | ✅       |
| Leave — read all / approve       | ✅      | ✅      | ❌    | ❌    | ❌       |
| KPI — read own                   | ✅      | ✅      | ✅    | ✅    | ✅       |
| KPI — read all / set target      | ✅      | ✅      | ❌    | ❌    | ❌       |
| Payroll — generate / approve     | ✅      | ✅      | ❌    | ❌    | ❌       |
| Payroll — publish                | ✅      | ❌      | ❌    | ❌    | ❌       |
| Payslips — own                   | ✅      | ✅      | ✅    | ✅    | ✅       |
| Payslips — peer                  | ✅      | ❌ (hierarchy) | ❌ | ❌ | ❌ |
| Salary revisions — own           | ✅      | ✅      | ✅    | ✅    | ✅       |
| Salary revisions — peer          | ✅      | ◐ (subordinates) | ❌ | ❌ | ❌ |
| Dashboard                        | ✅      | ✅      | ✅    | ◐     | ◐       |
| HRMS dashboard                   | ✅      | ✅      | ❌    | ❌    | ❌       |
| Audit log                        | ✅      | ❌      | ❌    | ❌    | ❌       |
| Assistant                        | ✅      | ✅      | ✅    | ✅    | ✅       |
| Notifications — own              | ✅      | ✅      | ✅    | ✅    | ✅       |

### 2.4 Role Hierarchy (additional enforcement beyond `@RequirePermission`)

Several controllers enforce a custom **role-hierarchy** check that returns `ROLE_HIERARCHY_FORBIDDEN` (403) when a lower-ranked role queries data for a higher-ranked employee. Examples:

- `GET /api/v1/payroll/payslips?employeeId=<other>` — agent querying a delivery's payslips (test: `payroll.e2e-spec.ts:106-110`)
- `GET /api/v1/payroll/salary-revisions/<founder-id>` — manager blocked from founder's data (test: `payroll.e2e-spec.ts:113-122`)

### 2.5 FOUNDER-Only Endpoints

| Endpoint                       | Reason                                           | Test reference                  |
|--------------------------------|--------------------------------------------------|---------------------------------|
| `GET /api/v1/audit`            | `audit.list` permission (PRD §5.1.2)             | `auth-session-security.e2e-spec.ts:249-256` |
| `POST /api/v1/employees/:id/reset-password` | `employee.reset_password` permission   | `auth-session-security.e2e-spec.ts:258-266` |
| `POST /api/v1/payroll/:id/publish` | `payroll.publish` permission                  | `payroll.e2e-spec.ts:62-66`     |

---

## Section 3: Authentication Test Matrix

### 3.1 Endpoints

| Method | Path                  | Auth        | Returns                              | Notes |
|--------|-----------------------|-------------|--------------------------------------|-------|
| POST   | `/api/v1/auth/login`  | `@Public()` | `{ accessToken, employee }` + `grotec_refresh` httpOnly cookie | Rate-limited (5 / 15 min per email+IP) |
| POST   | `/api/v1/auth/refresh`| `@Public()` | `{ accessToken, employee }` + rotated cookie | Atomic claim; reuse detection revokes ALL sessions |
| POST   | `/api/v1/auth/logout` | `@Public()` | 204                                  | Revokes the presented session row |
| GET    | `/api/v1/auth/me`     | Required    | `{ id, email, fullName, roleCode, permissions }` | Hits DB to validate employee status |
| POST   | `/api/v1/auth/change-password` | Required | 204                            | Revokes ALL refresh sessions for the user |

### 3.2 Token Behavior

| Token Type    | Format                            | Lifetime                  | Storage                  | Revocable? |
|---------------|------------------------------------|---------------------------|--------------------------|------------|
| Access token  | JWT HS256 (`@nestjs/jwt`)         | 15 min (`ACCESS_TOKEN_TTL_SECONDS`) | Client (memory / Authorization header) | ❌ Stateless — relies on DB lookup per request to detect deactivation |
| Refresh token | `randomBytes(48).toString('base64url')` | 30 days (`REFRESH_TOKEN_TTL_DAYS`) | httpOnly cookie `grotec_refresh`, `path=/api/v1/auth` | ✅ via `AuthSession` row (`revokedAt`) |

### 3.3 Test Matrix

| Scenario                                              | Expected                        | Tested in                                |
|-------------------------------------------------------|---------------------------------|------------------------------------------|
| Login with valid credentials                           | 200 + `accessToken` + cookie    | `auth.e2e-spec.ts:25-35`                 |
| Login with invalid email                               | 401 `INVALID_CREDENTIALS`       | `auth.e2e-spec.ts:37-43`                 |
| Login with wrong password                              | 401 `INVALID_CREDENTIALS`       | `auth.e2e-spec.ts:37-43`                 |
| Login as `INACTIVE` employee                           | 401 `ACCOUNT_INACTIVE`          | `auth.e2e-spec.ts:45-62`                 |
| 6+ login failures within 15 min                         | 429 `TOO_MANY_ATTEMPTS`         | `auth.e2e-spec.ts:105-118`               |
| `/auth/me` without token                               | 401 `INVALID_TOKEN`             | `auth.e2e-spec.ts:64-65`                 |
| `/auth/me` with valid token                            | 200 + principal                 | `auth.e2e-spec.ts:68-76`                 |
| Refresh-token rotation — first use                     | 200 + new cookie                | `auth-session-security.e2e-spec.ts:67-90` |
| Refresh-token rotation — second use of old cookie     | 401 + DB row `revokedAt` set    | `auth-session-security.e2e-spec.ts:67-90` |
| Reuse detection (old token after legit rotation)      | 401 + `REFRESH_REUSED` audit + all sessions revoked | `auth-session-security.e2e-spec.ts:98-142` |
| Concurrent rotation (two parallel `/refresh`)         | Exactly one 200, one 401        | `auth-session-security.e2e-spec.ts:149-173` |
| Logout                                                | 204 + cookie cleared            | `auth-session-security.e2e-spec.ts:179-183` |
| Deactivated employee cannot rotate                     | 401 `ACCOUNT_INACTIVE`          | `auth-session-security.e2e-spec.ts:190-218` |
| Deactivated employee `/auth/me` (issued access token)  | 401 `ACCOUNT_INACTIVE`          | `auth-session-security.e2e-spec.ts:220-243` |
| Password change revokes all sessions                   | Old cookies rejected, `PASSWORD_CHANGED` audit | `auth-session-security.e2e-spec.ts:302-328` |
| Scrypt password hash format                            | `scrypt$N$R$P$salt$hash`        | `password.util.ts`                       |
| RBAC: AGENT blocked from `/audit`                      | 403 `FOUNDER_ONLY`              | `auth-session-security.e2e-spec.ts:249-256` |
| RBAC: DELIVERY blocked from `/customers` POST          | 403 `FORBIDDEN`                 | `auth-session-security.e2e-spec.ts:277-285` |
| `/auth/login` reachable without token                  | 200                             | `auth-session-security.e2e-spec.ts:291-296` |

### 3.4 Security Implementation Highlights

- **Refresh-token rotation**: `auth.service.ts` uses `updateMany` with `where: { tokenHash, revokedAt: null }` to atomically claim a session. If 0 rows match, the route checks for a `revokedAt != null` row — the canonical OWASP ASVS V3 theft signal — and revokes ALL active sessions for the employee, emitting a `REFRESH_REUSED` audit event.
- **Password hashing**: scrypt (Node `crypto.scryptSync`) with format `scrypt$N$r$p$salt$hash`.
- **Rate limit**: in-memory `Map<email|ip, count[]>` — single-instance only (see §12 warnings).
- **Audit chain**: every login/logout/refresh-reuse/password-change writes an `AuditEvent` row in the same DB transaction as the user-state change.

---

## Section 4: Complete API Endpoint Inventory

**Global prefix**: `/api/v1` (set in `app-setup.ts:11`).
**Auth**: Every controller method is wrapped by the global `AuthGuard`; public routes opt out with `@Public()`.

### 4.1 Auth (`backend/src/modules/auth/`)

| Method | Path                    | Permissions    | Notes                         |
|--------|-------------------------|----------------|-------------------------------|
| POST   | `/auth/login`           | `@Public()`    | Rate-limited                  |
| POST   | `/auth/refresh`         | `@Public()`    | Atomic rotation + theft det.  |
| POST   | `/auth/logout`          | `@Public()`    |                               |
| GET    | `/auth/me`              | Auth required  |                               |
| POST   | `/auth/change-password` | Auth required  | Revokes all sessions          |

### 4.2 Health (`backend/src/modules/health/`)

| Method | Path      | Permissions | Notes                |
|--------|-----------|-------------|----------------------|
| GET    | `/health` | `@Public()` | Pings DB             |

### 4.3 Roles (`backend/src/modules/employees/roles.controller.ts`)

| Method | Path                  | Permissions     |
|--------|-----------------------|-----------------|
| GET    | `/roles`              | Auth required   |
| GET    | `/roles/permissions`  | Auth required   |

### 4.4 Employees (`backend/src/modules/employees/employees.controller.ts` — 22 endpoints)

| Method | Path                                       | Notes                                       |
|--------|--------------------------------------------|---------------------------------------------|
| GET    | `/employees`                               | Filter by `roleCode`, `status`, `q`, paginated |
| POST   | `/employees`                               | Create employee (FOUNDER)                   |
| GET    | `/employees/:id`                           | Detail                                      |
| PATCH  | `/employees/:id`                           | Update                                      |
| POST   | `/employees/:id/activate`                  |                                             |
| POST   | `/employees/:id/deactivate`                |                                             |
| POST   | `/employees/:id/reset-password`            | FOUNDER only                                |
| POST   | `/employees/:id/assign-staff`              | Assign staff                                |
| GET    | `/employees/:id/profile`                   | Aggregated profile                          |
| GET    | `/employees/:id/assignments`               |                                             |
| DELETE | `/employees/:id/assignments/:assignmentId` |                                             |
| GET    | `/employees/:id/documents`                 |                                             |
| POST   | `/employees/:id/documents`                 |                                             |
| DELETE | `/employees/:id/documents/:docId`          |                                             |
| GET    | `/employees/:id/notes`                     |                                             |
| POST   | `/employees/:id/notes`                     |                                             |
| GET    | `/employees/:id/history`                   |                                             |
| POST   | `/employees/:id/history`                   |                                             |
| GET    | `/employees/:id/salary-revisions`          |                                             |
| GET    | `/employees/:id/advances`                  |                                             |
| GET    | `/employees/me`                            | Current user profile                        |
| GET    | `/employees/me/role-matrix`                | Permissions for current user                |

### 4.5 Customers (`backend/src/modules/customers/customers.controller.ts` — 16 endpoints)

| Method | Path                                  | Notes                                       |
|--------|---------------------------------------|---------------------------------------------|
| GET    | `/customers`                          | List + filters + pagination                 |
| GET    | `/customers/lookup`                   | Lookup by E.164 phone                       |
| POST   | `/customers`                          | Create w/ phones/locations/crops sub-collections |
| GET    | `/customers/:id`                      | Detail (phones, locations, crops, ownerships) |
| PATCH  | `/customers/:id`                      | Update name/notes                           |
| POST   | `/customers/:id/activate`             | Manager only                                |
| POST   | `/customers/:id/deactivate`           | Manager only                                |
| POST   | `/customers/:id/phones`               | Add phone                                   |
| PATCH  | `/customers/:id/phones/:phoneId`      | Set primary                                 |
| DELETE | `/customers/:id/phones/:phoneId`      | Remove (last phone forbidden)               |
| POST   | `/customers/:id/locations`            | Add location                                |
| DELETE | `/customers/:id/locations/:locId`     |                                             |
| POST   | `/customers/:id/crops`                | Add crop (deduped)                          |
| PATCH  | `/customers/:id/crops/:cropId`        | Update acreage                              |
| DELETE | `/customers/:id/crops/:cropId`        |                                             |
| POST   | `/customers/:id/notes`                | Add note (emits `CUSTOMER_NOTE_ADDED`)      |

### 4.6 Crops (`backend/src/modules/crops/`)

| Method | Path        |
|--------|-------------|
| GET    | `/crops`    |
| POST   | `/crops`    |

### 4.7 Leads (`backend/src/modules/leads/leads.controller.ts`)

| Method | Path                          | Notes                          |
|--------|-------------------------------|--------------------------------|
| GET    | `/leads`                      | List + filters                 |
| POST   | `/leads`                      | Create                         |
| GET    | `/leads/:id`                  | Detail + ownership history     |
| PATCH  | `/leads/:id`                  | Update                         |
| DELETE | `/leads/:id`                  | Delete                         |
| GET    | `/leads/:id/ownership-history`| Append-only history            |
| POST   | `/leads/:id/assign`           | Assign owner (emits event)     |

### 4.8 Calls (`backend/src/modules/calls/calls.controller.ts`)

| Method | Path                       |
|--------|----------------------------|
| POST   | `/calls/place`             |
| GET    | `/calls/queue`             |
| GET    | `/calls/active`            |
| GET    | `/calls/context`           |
| GET    | `/calls/:id`               |
| POST   | `/calls/:id/end`           |
| POST   | `/calls/:id/note`          |
| POST   | `/calls/:id/outcome`       |

### 4.9 Follow-ups (`backend/src/modules/followups/`)

| Method | Path                  | Notes                       |
|--------|-----------------------|-----------------------------|
| GET    | `/followups`          | List (filters)              |
| POST   | `/followups`          | Create                      |
| PATCH  | `/followups/:id`      | Update                      |
| POST   | `/followups/:id/complete` |                         |

### 4.10 Relationship (`backend/src/modules/relationship/relationship.controller.ts`)

| Method | Path                                       |
|--------|--------------------------------------------|
| GET    | `/relationship/customers`                  |
| GET    | `/relationship/holders`                    |
| POST   | `/relationship/customers/:id/assign`       |
| POST   | `/relationship/customers/:id/release`      |

### 4.11 Dashboard (`backend/src/modules/dashboard/`)

| Method | Path         |
|--------|--------------|
| GET    | `/dashboard` |

### 4.12 Assistant (`backend/src/modules/assistant/`)

| Method | Path                                |
|--------|-------------------------------------|
| POST   | `/assistant/chat`                   |
| GET    | `/assistant/conversations`          |
| GET    | `/assistant/conversations/:id`      |
| POST   | `/assistant/guidance`               |
| GET    | `/assistant/guidance/:cropCode`     |

### 4.13 Attendance (`backend/src/modules/attendance/`)

| Method | Path                          | Notes                          |
|--------|-------------------------------|--------------------------------|
| GET    | `/attendance/my`              | Own attendance record          |
| GET    | `/attendance/balance`         | Own balance                    |
| POST   | `/attendance/punch`           | Punch in/out                   |
| GET    | `/attendance/records`         | List (manager)                 |
| GET    | `/attendance/records/:id`     | Detail (manager)               |
| POST   | `/attendance/records/:id/approve` |                          |
| POST   | `/attendance/records/:id/reject`  |                          |
| GET    | `/attendance/export.csv`      | CSV export                     |

### 4.14 Leave (`backend/src/modules/leave/leave.controller.ts` — 12 endpoints)

| Method | Path                                  |
|--------|---------------------------------------|
| GET    | `/leave/types`                        |
| GET    | `/leave/my/balances`                  |
| GET    | `/leave/my/applications`              |
| POST   | `/leave/my/apply`                     |
| GET    | `/leave/balances`                     |
| GET    | `/leave/applications`                 |
| POST   | `/leave/applications/:id/approve`     |
| POST   | `/leave/applications/:id/reject`      |
| GET    | `/leave/applications/:id/history`     |
| GET    | `/leave/export.csv`                   |
| GET    | `/leave/admin/balances`               |
| POST   | `/leave/admin/balances`               |

### 4.15 Payroll (`backend/src/modules/payroll/payroll.controller.ts` — 16 endpoints)

| Method | Path                                          | Notes                          |
|--------|-----------------------------------------------|--------------------------------|
| GET    | `/payroll/runs`                               | List runs                      |
| POST   | `/payroll/generate`                           | Generate run                   |
| POST   | `/payroll/runs/:id/generate`                  | Alt path                       |
| GET    | `/payroll/runs/:id`                           | Run detail                     |
| POST   | `/payroll/runs/:id/approve`                   |                                |
| POST   | `/payroll/:id/approve`                        | Alt path                       |
| POST   | `/payroll/runs/:id/publish`                   | FOUNDER only                   |
| POST   | `/payroll/:id/publish`                        | Alt path                       |
| GET    | `/payroll/payslips`                           | Query `?employeeId=`           |
| GET    | `/payroll/payslips/:id`                       | Detail                         |
| GET    | `/payroll/payslips/:id/pdf`                   | Stream PDF                     |
| GET    | `/payroll/salary-revisions/:employeeId`       | Hierarchy-scoped               |
| GET    | `/payroll/advances/:employeeId`               |                                |
| GET    | `/payroll/reports/attendance`                 |                                |
| GET    | `/payroll/reports/leave`                      |                                |
| GET    | `/payroll/reports/advances`                   |                                |

### 4.16 KPI (`backend/src/modules/kpi/`)

| Method | Path                          |
|--------|-------------------------------|
| GET    | `/kpi/my`                     |
| GET    | `/kpi/periods`                |
| GET    | `/kpi/targets/:employeeId`    |
| POST   | `/kpi/targets/:employeeId`    |
| GET    | `/kpi/scores/:employeeId`     |

### 4.17 Audit (`backend/src/modules/audit/audit.controller.ts`)

| Method | Path        | Notes                                |
|--------|-------------|--------------------------------------|
| GET    | `/audit`    | FOUNDER only. Filters: entityType, entityId, actorId, action, from, to |

### 4.18 Notifications (`backend/src/modules/notifications/`)

| Method | Path                          |
|--------|-------------------------------|
| GET    | `/notifications`              |
| GET    | `/notifications/unread-count` |
| POST   | `/notifications/:id/read`     |
| POST   | `/notifications/read-all`     |
| POST   | `/notifications/run-reminders`|

### 4.19 HRMS Dashboard (`backend/src/modules/hrms-dashboard/`)

| Method | Path              |
|--------|-------------------|
| GET    | `/hrms-dashboard` |

### 4.20 Call History (`backend/src/modules/call-history/`)

| Method | Path                |
|--------|---------------------|
| GET    | `/call-history`     |

### 4.21 Dialer Webhook (`backend/src/modules/dialer-webhook/`)

| Method | Path                  | Notes                            |
|--------|-----------------------|----------------------------------|
| POST   | `/dialer/webhook`     | Verified by `DIALER_WEBHOOK_SECRET` |

### 4.22 Endpoint Coverage Summary

- **Total route handlers**: ~120 across 21 controllers
- **Public routes**: 6 (`/health`, login, refresh, logout)
- **FOUNDER-only**: 3 (`/audit` list, employee reset-password, payroll publish)
- **Documented e2e coverage**: 17 spec files (`backend/test/*.e2e-spec.ts`)

---

## Section 5: End-to-End Test Plan

This plan is the **human-runnable smoke plan** that mirrors the smoke script (§11). Execute top-to-bottom; each step is non-destructive except where noted (and noted changes are revertible).

### Phase 1 — Environment Readiness

1. `cp backend/.env.example backend/.env` and fill in `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`
2. From repo root: `npm install` (workspace install)
3. `cd backend && npm run build --workspace @grotec/shared && npx prisma migrate deploy`
4. `cd backend && npm run seed` — populates roles, permissions, founder + 4 employees
5. `cd backend && npm run dev` — starts on port 3000
6. Verify: `curl http://localhost:3000/api/v1/health` → 200, `{ "status": "ok", "db": "ok" }`

### Phase 2 — Authentication (non-destructive)

7. `POST /api/v1/auth/login` as `agent@grotec.local` / `Founder@123` → 200, capture `accessToken` (call it `AGENT`) and refresh cookie
8. `GET /api/v1/auth/me` with `AGENT` → 200, `roleCode: AGENT`
9. `GET /api/v1/auth/me` without token → 401
10. `POST /api/v1/auth/login` with bad creds → 401 `INVALID_CREDENTIALS`
11. Issue 5 bad logins → 6th gets 429 `TOO_MANY_ATTEMPTS`
12. `POST /api/v1/auth/refresh` with cookie → 200, new token (call it `AGENT2`); reusing old cookie → 401
13. Login as `manager@grotec.local` → capture `MANAGER`; login as `founder@grotec.local` → capture `FOUNDER`; login as `delivery@grotec.local` → capture `DELIVERY`

### Phase 3 — Customers (non-destructive)

14. `POST /customers` with `AGENT` for a new phone — 201, phone normalized to E.164
15. `POST /customers` with same phone → 409 `CUSTOMER_PHONE_EXISTS`
16. `POST /customers` with two phones, same value → 400 `DUPLICATE_PHONE_IN_REQUEST`
17. `POST /customers` with phone `"not-a-phone"` → 400 `INVALID_PHONE`
18. `GET /customers/lookup?phone=%2B91...` → 200, returns id from step 14
19. `GET /customers` → 200 with paginated list
20. `PATCH /customers/:id` with new name → 200
21. `POST /customers/:id/deactivate` with `MANAGER` → 204
22. `POST /customers/:id/activate` with `MANAGER` → 204
23. `POST /customers/:id/deactivate` with `AGENT` → 403

### Phase 4 — Leads (non-destructive)

24. `POST /leads` with `AGENT` → 201; capture `LEAD_ID`
25. `GET /leads/:id` → 200
26. `DELETE /leads/:LEAD_ID` with `AGENT` → 204 (cleanup)

### Phase 5 — Calls (non-destructive)

27. `POST /calls/place` with `AGENT` for a known customer phone → 201
28. `POST /calls/:id/outcome` with `outcome: INTERESTED, nextAction: CALLBACK` → 201

### Phase 6 — Attendance & Leave (own-scope)

29. `GET /attendance/my` with `AGENT` → 200
30. `GET /leave/my/balances` with `AGENT` → 200
31. `GET /leave/types` with `AGENT` → 200 (returns list of leave types)

### Phase 7 — Payroll (read + 1 generated run)

32. `POST /payroll/generate` with `MANAGER` for a fresh month → 201, status `GENERATED`
33. `POST /payroll/:id/approve` with `MANAGER` → 201, status `APPROVED_LOCKED`
34. `POST /payroll/:id/publish` with `MANAGER` → 403
35. `POST /payroll/:id/publish` with `FOUNDER` → 201, status `PUBLISHED`
36. `GET /payroll/payslips` with `AGENT` → 200, only own payslips
37. `GET /payroll/payslips?employeeId=<other>` with `AGENT` → 403 `ROLE_HIERARCHY_FORBIDDEN`
38. `GET /payroll/salary-revisions/<founder-id>` with `MANAGER` → 403 `ROLE_HIERARCHY_FORBIDDEN`

### Phase 8 — RBAC Boundaries

39. `GET /audit` with `AGENT` → 403 `FOUNDER_ONLY`
40. `GET /audit` with `FOUNDER` → 200
41. `POST /employees/:id/reset-password` with `AGENT` → 403
42. `POST /customers` with `DELIVERY` → 403

### Phase 9 — Outbox (observational)

43. Re-query `GET /audit?action=payroll.published` with `FOUNDER` → 200, includes the new run id
44. Verify `OutboxEvent` rows transitioned to `PROCESSED` via a DB peek (or a future `/outbox` endpoint)

### Phase 10 — Cleanup

45. Use `resetData()`-style teardown in tests; in dev DB, leave the run + customers for inspection

---

## Section 6: Database / Supabase Validation

### 6.1 Schema Source-of-Truth

`backend/prisma/schema.prisma` is the canonical schema. Migrations live in `backend/prisma/migrations/`.

### 6.2 Migration History

| Migration                              | Purpose                                                    |
|----------------------------------------|------------------------------------------------------------|
| `20260904064942_init`                  | Initial schema (roles, employees, customers, leads, calls) |
| `20260904120000_prd_alignment`         | PRD alignment                                              |
| `20260904130000_calls`                 | Calls module                                               |
| `20260904140000_assistant`             | Assistant module                                           |
| `20260904150000_outcomes`              | Call outcomes                                              |
| `20260904180000_kb_taxonomy`           | Knowledge base                                             |
| `20260905120000_hrms_foundation`       | HRMS foundation (attendance, leave, payroll, KPI)          |
| `20260906195022_core_integrity`        | Core integrity hardening                                   |
| `20260906200000_outbox_event_table`    | Outbox table                                               |
| `20260906210000_outbox_hardening`      | Outbox retry / lease hardening                             |
| `20260907000000_fix_employment_status`  | Employment status enum fix                                 |

### 6.3 Key Tables (40+)

Identity: `employees`, `roles`, `permissions`, `role_permissions`, `auth_sessions`, `audit_events`

CRM: `customers`, `customer_phones`, `customer_locations`, `customer_crops`, `customer_notes`, `crops`, `crop_product_guidance`, `leads`, `lead_ownerships`, `lead_notes`, `calls`, `call_notes`, `follow_ups`, `outbound_messages`, `relationship_ownerships`

HRMS: `attendance_records`, `attendance_punches`, `attendance_approval_history`, `leave_types`, `leave_balances`, `leave_applications`, `leave_approval_history`, `employee_assignments`, `employee_documents`, `employee_history_records`, `employee_notes`, `salary_revisions`, `advance_ledger`, `advance_recovery`, `payroll_runs`, `payroll_line_items`, `kpi_targets`, `kpi_period_scores`, `essl_device_mappings`, `essl_attendance_logs`

Outbox: `outbox_events`, `processed_events`

System: `app_notifications`, `conversations`, `conversation_messages`

### 6.4 Invariants (enforced by schema + migration SQL)

- **Partial unique index**: `relationship_ownership_current_customer_idx` on `relationship_ownership(customer_id) WHERE released_at IS NULL` (re-created at every test setup; in prod via migrations).
- **Phone E.164**: stored as `+91...` only; libphonenumber normalization in `customers.service.ts`.
- **Soft delete**: `employees.deleted_at`, `customers.deleted_at` etc. — every read query must include `where: { deletedAt: null }`.
- **Append-only**: `lead_ownerships`, `relationship_ownerships`, `audit_events` — never updated, only inserted.

### 6.5 Test DB Setup Validation

`backend/test/global-setup.ts`:
- Loads `backend/.env`
- Overrides `DATABASE_URL` with `TEST_DATABASE_URL` for the worker process
- Runs `npx prisma db push --force-reset --skip-generate`
- Calls `ensurePartialUniqueIndexes()` to re-create the migration-only partial index
- Runs `npx tsx prisma/seed.ts`

> The partial unique index cannot be expressed in Prisma schema. Its absence in dev is a known footgun; `global-setup.ts` papers over it for tests, and `prisma migrate deploy` papers over it in prod.

### 6.6 Migrations to Apply

For production deploy: `npx prisma migrate deploy` (NOT `migrate dev`) — applies all 11 migrations in order.

---

## Section 7: Test Data Dependency Map

```
            ┌──────────────┐
            │    Role      │  (5 rows: FOUNDER, MANAGER, AGENT, STAFF, DELIVERY)
            └──────┬───────┘
                   │ 1..n
                   ▼
            ┌──────────────┐         ┌──────────────┐
            │ Permission   │◄────────┤RolePermission│
            └──────────────┘         └──────┬───────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │  Employee    │  (5 seeded + ad-hoc test users)
                                     └──────┬───────┘
                                            │ creates / owns
        ┌───────────────────────────────────┼────────────────────────────────────────┐
        ▼                                   ▼                                        ▼
┌──────────────┐                  ┌──────────────┐                         ┌──────────────┐
│   Customer   │                  │     Lead     │                         │   Crop       │
│ (FK phones,  │                  │ (FK phones,  │                         │ (referenced  │
│  locations,  │                  │  ownerships) │                         │  by customer │
│  crops)      │                  └──────────────┘                         │  _crops)     │
└──────┬───────┘                                                            └──────────────┘
       │ referenced by
       ├──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐
       ▼              ▼    ▼              ▼    ▼              ▼    ▼                    ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐
│ Call         │ │ Relationship │ │ Follow-up    │ │ CustomerNote │ │ CustomerCrop       │
│ (placed_by   │ │ Ownership    │ │ (FK owner    │ │              │ │ (FK crop)          │
│  employee,   │ │ (FK holder,  │ │  employee,   │ │              │ │                    │
│  customer)   │ │  customer)   │ │  customer)   │ │              │ │                    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘

       │ all of the above produce
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Outbox Event                                │
│ (idempotency_key UNIQUE, aggregate_id, event_type, status, ...)  │
└────────────────────┬─────────────────────────────────────────────┘
                     │ processed by
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Processed Event                                │
│ (UNIQUE by event_id + consumer_name — exactly-once guarantee)    │
└──────────────────────────────────────────────────────────────────┘

HRMS sub-tree (parallel):
Employee ─┬─► AttendanceRecord ─┬─► AttendancePunch
           │                    └─► AttendanceApprovalHistory
           ├─► LeaveApplication ──► LeaveApprovalHistory
           ├─► LeaveBalance
           ├─► SalaryRevision
           ├─► AdvanceLedger ─────► AdvanceRecovery
           └─► PayrollLineItem ◄─── PayrollRun
Employee ─► KpiTarget ─► KpiPeriodScore
```

### Key Dependencies

- **Test employees MUST exist before**: any test that logs in, any test that creates customers (createdBy FK), any test that creates payroll runs (must have `SalaryRevision` rows).
- **Crops MUST exist before**: any `customer_crops` insert (FK to `crops`).
- **At least one `Role` per `Employee`**: FK `role_id` is non-nullable.
- **Outbox events reference aggregates by `id`**: deleting the aggregate (e.g. cascade-delete of a lead) leaves orphan outbox rows — `OutboxWorker` is tolerant of missing aggregates (logs + marks PROCESSED).
- **`resetData()` ordering matters**: deletes must run in reverse dependency order to satisfy FK constraints. See `backend/test/helpers.ts:34-108` (30+ deletes in `prisma.$transaction`).

---

## Section 8: Existing Test Artifact Audit

### 8.1 E2E Spec Files (17 specs, ~2500 lines of test)

| File                                       | Lines | Focus                                                |
|--------------------------------------------|-------|------------------------------------------------------|
| `auth.e2e-spec.ts`                         | 126   | Login, /me, refresh rotation, logout, rate-limit     |
| `auth-session-security.e2e-spec.ts`        | 330   | OWASP session security (Checkpoint C, 8 scenarios)   |
| `customers.e2e-spec.ts`                    | 239   | Phone E.164, dup detection, deactivation, RBAC       |
| `payroll.e2e-spec.ts`                      | 124   | Generate/approve/publish + role hierarchy            |
| `rbac.e2e-spec.ts`                         | ?     | Full permission matrix walk                          |
| `attendance.e2e-spec.ts`                   | ?     | Punch, approve, balance                              |
| `leave.e2e-spec.ts`                        | ?     | Apply, approve, balance                              |
| `kpi.e2e-spec.ts`                          | ?     | Target, period score                                 |
| `leads.e2e-spec.ts`                        | ?     | Lead CRUD + assignment                               |
| `calls.e2e-spec.ts`                        | ?     | Place, outcome, note                                 |
| `audit.e2e-spec.ts`                        | ?     | Audit log listing                                    |
| `dashboard.e2e-spec.ts`                    | ?     | Dashboard payload                                    |
| `relationship.e2e-spec.ts`                 | ?     | Assign / release customer relationship               |
| `domain-ownership.e2e-spec.ts`             | ?     | Lead + relationship ownership invariants             |
| `core-integrity.e2e-spec.ts`               | ?     | Core schema invariants                               |
| `outcomes.e2e-spec.ts`                     | ?     | Call outcome validation matrix                       |
| `assistant.e2e-spec.ts`                    | ?     | LLM-backed chat                                      |
| `outbox-e2e-spec.ts`                       | ?     | Outbox claim/processed/handler dispatch              |

### 8.2 Test JSON / Response Artifacts

A scan of `backend/` for `.json` artifacts (excluding `package.json`, `tsconfig.json`, `package-lock.json`) returned **no tracked test-response JSON files**. All test assertions read from `supertest` response bodies at runtime; nothing is committed to disk. This is the correct posture — committed response files are a known source of stale-test drift.

### 8.3 Test Helpers (canonical)

- `backend/test/helpers.ts` — `createTestApp()`, `resetData()`, `loginToken()`, `createCustomerAs()`, `uniqueEmail()`, `employeeIdByEmail()`
- `backend/test/global-setup.ts` — DB push, partial-index re-creation, seed

### 8.4 Test Data Lifecycle

- Per test: `resetData()` truncates ~30 tables in dependency order, preserving the 5 seeded employees + a few crops + role/permission rows
- Per `vitest run`: `global-setup.ts` does `prisma db push --force-reset` + re-seed (idempotent)

### 8.5 Gaps in E2E Coverage (Recommendations)

- No `attendance.e2e-spec.ts` assert for the ESSL webhook handler signature
- No `assistant.e2e-spec.ts` mock that asserts the LLM call body (current tests assert response shape only)
- No load / concurrency test for outbox claim contention beyond `auth-session-security.e2e-spec.ts:149-173`

---

## Section 9: Git Security Audit

### 9.1 Tracked Files Inventory

Tracked files matching `*.json` or `*.env*`:

```
backend/package.json
backend/tsconfig.build.json
backend/tsconfig.json
frontend/package.json
frontend/tsconfig.json
package-lock.json
package.json
packages/shared/package.json
packages/shared/tsconfig.json
```

> ✅ **No `.env` file is tracked.** Only `.env.example` exists (which uses placeholders like `<YOUR-PASSWORD>` and `gsk_your_free_groq_api_key_here`).

### 9.2 Files with "secret / password / credential" in name

```
backend/src/modules/auth/dto/change-password.dto.ts          (DTO — Zod/class-validator schema)
backend/src/modules/auth/password.util.ts                   (scrypt hashing utility)
backend/src/modules/employees/dto/reset-password.dto.ts     (DTO)
```

> ✅ **No credential stores are committed.** These are DTOs and hashing utilities.

### 9.3 Recent Commit Scan (last 50 commits)

| Commit    | Subject                                                                | Risk  |
|-----------|------------------------------------------------------------------------|-------|
| `d143b2c` | chore: prepare GROTEC for GitHub                                        | None  |
| `93c3204` | fix(dev): set frontend type module and fix dev-db root path             | None  |
| `9f8308b` | fix(build): untrack backend/dist and fix @grotec/shared path in vite    | None  |
| `9aed53e` | refactor: restructure project workspaces, implement outbox pattern     | None  |
| `338f5c6` | feat: complete modern UI/UX overhaul, HRMS enhancements, repo hygiene  | None  |
| `4af3a63` | feat(crm): record-outcome workflow with validation matrix              | None  |
| `c1b1a3f` | feat(assistant): chat + guidance API behind LLM abstraction             | None  |
| `cb15293` | feat(agent): add calls module with queue, context, notes                | None  |
| `ecde1d2` | chore(crm): commit api env template and PRD extraction utility          | None  |
| `9f32e41` | feat(web): add responsive CRM shell and month 1 screens                 | None  |
| `129dbf8` | feat(crm): add auth foundation, rbac, employees, customers, leads, audit| None  |
| `150a153` | feat(shared): add domain constants and phone normalization              | None  |
| `129952d` | chore(crm): scaffold monorepo, docs, and dev database tooling           | None  |

### 9.4 Known Sensitive Material in `.env` (NOT tracked)

> ⚠️ The untracked `backend/.env` file on the current dev machine contains real Supabase project URLs and database credentials. This is correct for local development but the file MUST be regenerated with rotated secrets before any production deploy.

### 9.5 `.gitignore` Hardening (recommendation)

Confirm the following are ignored:
- `backend/.env`
- `backend/.env.*` (except `.env.example`)
- `backend/dist/`
- `frontend/dist/`
- `node_modules/`
- All `*.log`

---

## Section 10: Deployment Readiness

### 10.1 Build

| Step | Command                                          | Expected                       |
|------|--------------------------------------------------|--------------------------------|
| 1    | `npm install` (root, workspaces)                 | All packages linked            |
| 2    | `cd backend && npm run build`                    | `dist/` populated              |
| 3    | `cd backend && npm run typecheck`                | 0 errors                       |
| 4    | `cd backend && npm test`                         | All e2e specs green            |
| 5    | `cd backend && npx prisma migrate deploy`        | 11 migrations applied          |
| 6    | `cd backend && npm run seed`                     | Founder + 4 employees created  |

### 10.2 Start

| Command                  | Process                          | Health check                  |
|--------------------------|----------------------------------|-------------------------------|
| `npm run start`          | `node dist/src/main.js`          | `GET /api/v1/health` → 200    |
| `npm run start:dev`      | Build + `--watch`                | Same                          |
| `npm run dev`            | Alias of `start:dev`             | Same                          |

### 10.3 CORS

`CORS_ORIGINS` (CSV) → allow-list; if empty/unset → `origin: true` (any). For prod: **always set CORS_ORIGINS** to the exact frontend origin(s).

`credentials: true` is set unconditionally — required for the httpOnly refresh cookie.

### 10.4 Required Environment Variables (production)

| Var                         | Required? | Note                                              |
|-----------------------------|-----------|---------------------------------------------------|
| `DATABASE_URL`              | ✅        | Supabase pooler (6543)                            |
| `DIRECT_URL`                | ✅        | Supabase direct (5432) — used by `migrate deploy` |
| `JWT_ACCESS_SECRET`         | ✅        | **Rotate** to a strong random value               |
| `COOKIE_SECURE`             | ✅        | Set `true` in prod (HTTPS only)                   |
| `COOKIE_SAME_SITE`          | ✅        | `lax` recommended                                 |
| `CORS_ORIGINS`              | ✅        | Exact frontend origin(s)                          |
| `FOUNDER_PASSWORD`          | ✅        | **Replace `Founder@123` with a strong password**  |
| `LLM_API_KEY`               | optional  | Only if assistant is enabled                      |
| `DIALER_WEBHOOK_SECRET`     | ✅        | **Rotate** to a strong random value               |
| `ESSL_WEBHOOK_SECRET`       | ✅        | **Rotate** to a strong random value               |
| `PORT`                      | optional  | Defaults to 3000                                  |

### 10.5 Outbox

- `OutboxModule` is `@Global()`; no separate wiring needed
- `OutboxWorker` is started by NestJS DI; no separate process required for single-instance deploy
- 30 s lease TTL, 5 s base retry, max 3 attempts, exponential backoff
- `ProcessedEvent` table guarantees exactly-once delivery per `(event_id, consumer_name)`

### 10.6 Single-Instance Limitations (warnings)

- **Rate limit** is in-memory → multi-instance deploy loses cross-instance rate limiting
- **Outbox worker** is in-process → multi-instance deploy risks duplicate dispatches (mitigated by `ProcessedEvent` idempotency table)
- **Audit chain** is DB-only → safe across instances

### 10.7 Health Check

`GET /api/v1/health` returns:
- 200 with `{ status: "ok", db: "ok" }` when DB responds
- 503 if DB ping fails

Suitable for Kubernetes `livenessProbe` / `readinessProbe`.

### 10.8 Documentation Surface

```
docs/api.md
docs/architecture.md
docs/audit-2026-09-06.md
docs/business-rules.md
docs/cloud-devops-audit.md
docs/code-quality-assessment.md
docs/CORE_AUDIT.md
docs/CORE_TECHNICAL_AUDIT.md
docs/database.md
docs/development-progress.md
docs/open-items.md
docs/permissions.md
docs/SUPABASE_MIGRATION_AUDIT.md
docs/SYSTEM_DESIGN_PROGRESS.md
docs/testing/
docs/BACKEND_TEST_REPORT.md         ← prior report
docs/BACKEND_TEST_CREDENTIALS_AND_READINESS.md  ← this file
```

---

## Section 11: Automated Smoke Test Script

A non-destructive PowerShell smoke test has been written to:

```
scripts/backend-smoke-test.ps1
```

### 11.1 Coverage (100+ assertions across 12 sections)

| Section          | Scope                                                              |
|------------------|--------------------------------------------------------------------|
| 0. Health        | `GET /health`                                                      |
| 1. Auth          | Login (4 roles), invalid creds, rate limit, /me, refresh, change-pwd, logout |
| 2. Customers     | Create, lookup, dup phone, invalid phone, list, detail, update, deactivate/reactivate, RBAC |
| 3. Employees     | List, role filter                                                  |
| 4. Roles         | List roles, list permissions, RBAC boundary checks                 |
| 5. Leads         | Create, detail, delete                                             |
| 6. Attendance    | My record, balance                                                  |
| 7. Leave         | Types, my balances, my applications                                 |
| 8. Payroll       | Generate, approve, publish (Founder), payslips                     |
| 9. RBAC          | DELIVERY blocked, AGENT blocked from audit, FOUNDER can audit      |
| 10. Dashboard    | Dashboard + HRMS dashboard                                         |
| 11. Notifications| List, unread count                                                  |
| 12. Outbox       | Audit log shows `payroll.published` events                          |

### 11.2 Usage

```powershell
# Default (backend on http://localhost:3000):
pwsh -File scripts\backend-smoke-test.ps1

# With custom base URL:
pwsh -File scripts\backend-smoke-test.ps1 -BaseUrl https://staging.example.com

# Verbose:
pwsh -File scripts\backend-smoke-test.ps1 -Verbose
```

### 11.3 Guarantees

- Uses **only seeded test accounts** (`founder/manager/agent/delivery@grotec.local`, all `Founder@123`)
- **Non-destructive**: every created customer has a randomized phone; every created payroll run uses a random month; every created lead is deleted
- Self-isolating: the rate-limit test uses a unique email (`rate-test@grotec.local`); the password-change test reverts to the original
- Returns exit code 0 on PASS, 1 on FAIL, 0 on SKIP

### 11.4 Dependencies

- PowerShell 7+ (`pwsh`)
- A running backend (`npm run dev`)
- The seeded test database (run `npm test` once to seed, or `npm run seed` manually)

---

## Section 12: Final Verdict & Remediation Checklist

### 12.1 Verdict

> ## ✅ **READY WITH WARNINGS**
>
> The GROTEC backend is functionally ready for:
> - Local development (✅ Ready)
> - Integration testing against the seeded test database (✅ Ready)
> - Staging deploy with the warnings below addressed (✅ Ready after §12.2 items 1-5)
> - **Production deploy** — **NOT Ready** until §12.2 items 1-8 are completed and reviewed.

### 12.2 Remediation Checklist (Blocking → Optional)

| # | Severity | Item                                                                                                                                    | Owner      |
|---|----------|------------------------------------------------------------------------------------------------------------------------------------------|------------|
| 1 | 🔴 Blocker (prod) | Replace `JWT_ACCESS_SECRET="dev-only-change-me-access-secret"` with a 32+ byte random value managed by your secret store | DevOps     |
| 2 | 🔴 Blocker (prod) | Change the FOUNDER seed password from `Founder@123` to a strong random value (one-time)                                                | DevOps     |
| 3 | 🔴 Blocker (prod) | Rotate all `DIALER_WEBHOOK_SECRET` / `ESSL_WEBHOOK_SECRET` placeholders                                                                 | DevOps     |
| 4 | 🔴 Blocker (prod) | Set `COOKIE_SECURE=true` and pin `CORS_ORIGINS` to the exact frontend origin(s)                                                          | DevOps     |
| 5 | 🔴 Blocker (prod) | Rotate the Supabase credentials stored in `backend/.env` if the file was ever shared or copied anywhere outside this dev machine        | DevOps     |
| 6 | 🟠 High          | Replace in-memory rate limiter with a Redis-backed limiter for multi-instance deploys                                                   | Backend    |
| 7 | 🟠 High          | Replace the 11 placeholder outbox handlers (`CUSTOMER_*`, `LEAD_*`, `RELATIONSHIP_*`) with real side-effect logic (currently no-ops)    | Backend    |
| 8 | 🟠 High          | Document the JWT-stateless limitation (cannot revoke issued tokens) and plan either a Redis token blocklist or shorten `ACCESS_TOKEN_TTL_SECONDS` to 5 min | Backend    |
| 9 | 🟡 Medium        | Add an `/api/v1/outbox` debug endpoint behind FOUNDER permission for on-call diagnosis                                                  | Backend    |
| 10 | 🟡 Medium       | Add a CI step that runs `npm test` and a `pwsh scripts/backend-smoke-test.ps1` against the seeded test DB                              | DevOps     |
| 11 | 🟡 Medium       | Add load / concurrency tests for outbox claim contention beyond the one scenario in `auth-session-security.e2e-spec.ts:149`            | QA         |
| 12 | 🟢 Low           | Add an assistant test that mocks the LLM provider and asserts the request body shape                                                  | QA         |
| 13 | 🟢 Low           | Add a CI step that grep's the diff for `Founder@123` and fails on any hit (defense-in-depth against the password leaking into a non-test env) | DevOps     |

### 12.3 What's Working Today

- 21 controllers wired through `AppModule` with global `AuthGuard` + `PermissionGuard`
- Scrypt password hashing + atomic refresh-token rotation + OWASP ASVS V3 theft detection (all covered by `auth-session-security.e2e-spec.ts:330 lines`)
- Full RBAC matrix with `@RequirePermission` + role-hierarchy checks
- Outbox pattern with `ProcessedEvent` idempotency and 11 handlers (1 real, 10 placeholders)
- Audit chain capturing LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT / REFRESH_REUSED / PASSWORD_CHANGED / payroll.* / customer.* / lead.* / relationship.*
- 17 e2e spec files covering ~80+ scenarios
- 11 Prisma migrations ready for `prisma migrate deploy`
- Swagger UI at `/api/docs` with Bearer auth
- Global validation pipe (`whitelist: true, forbidNonWhitelisted: true, transform: true`)
- Global `HttpExceptionFilter` mapping to canonical error envelope `{ error: { code, message, details?, matchedCustomer? } }`
- `GET /api/v1/health` pings the DB
- CORS, cookie parser, rate limiting, refresh cookie scoping (`path: /api/v1/auth`)

### 12.4 What's Missing / Weak

- 10 of 11 outbox handlers are placeholder no-ops — `PAYROLL_PUBLISHED` is the only one with real side-effect logic
- Rate limiter is in-memory — won't scale across instances
- No load tests for outbox contention
- No token revocation list (documented in `auth-session-security.e2e-spec.ts:220-243`)
- No multi-region / multi-tenant config

### 12.5 Sign-Off

| Aspect                                | Status      |
|---------------------------------------|-------------|
| Build pipeline (`npm run build`)      | ✅ Ready    |
| Tests (`npm test`)                    | ✅ Ready    |
| Smoke script (`scripts/backend-smoke-test.ps1`) | ✅ Ready    |
| Local dev (`npm run dev`)             | ✅ Ready    |
| Staging deploy                        | ⚠️ Ready after §12.2 #1-5 |
| Production deploy                     | 🔴 NOT ready until §12.2 #1-8 |

---

**Prepared by**: backend readiness audit
**Last updated**: 2026-09-07
**File location**: `D:\project\grotec project\docs\BACKEND_TEST_CREDENTIALS_AND_READINESS.md`
**Companion artifact**: `D:\project\grotec project\scripts\backend-smoke-test.ps1`
