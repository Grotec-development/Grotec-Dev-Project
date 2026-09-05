# GROTEC FarmerOS Phase 1 — Test Evidence

## Monorepo Automated Test Suites (90 / 90 Tests Passed)
Command: `npm test` executed across all workspaces.

### 1. `@grotec/shared` (11 / 11 tests passed)
- `src/phone.spec.ts`: E.164 normalization, valid 10-digit Indian numbers, invalid inputs, edge-cases.

### 2. `@grotec/api` (76 / 76 tests passed across 11 test suites)
- `test/relationship.e2e-spec.ts` (6 tests): Relationship Manager ownership assignment, Sales conversion handoff, manager-scoped portfolio filtering, customer release & claim workflows.
- `test/outcomes.e2e-spec.ts` (9 tests): Three distinct outcomes (Interested, Not Interested, Not Answered), invariant validation (rejection of duplicate outcomes, rejection of nextAction without Interested).
- `test/calls.e2e-spec.ts` (11 tests): Call initiation, active call lifecycle, mid-call customer creation without call termination, follow-up scheduling.
- `test/customers.e2e-spec.ts` (14 tests): Customer CRUD, phone number uniqueness, duplicate handling, query filters.
- `test/assistant.e2e-spec.ts` (5 tests): Knowledge Base query typeahead, crop and problem category searching, guidance recommendations.
- `test/dashboard.e2e-spec.ts` (3 tests): Role-scoped metrics (Founder vs Manager vs Telecaller), empty states, conversion metric transitions.
- `test/rbac.e2e-spec.ts` (7 tests): 4 login roles (Founder, Manager/Admin, Telecaller/Agent, Staff), route and model access scoping, Staff role forbidden on CRM endpoints.
- `test/leads.e2e-spec.ts` (6 tests): Lead status transitions, lead assignment, conversion to customer.
- `test/auth.e2e-spec.ts` (8 tests): Password authentication, JWT issue, token refresh, permission claims.
- `test/audit.e2e-spec.ts` (3 tests): Mutation audit logging, actor and timestamp capture, before/after JSON diffs.
- `src/modules/calls/dialer/mock-auto-dialer.provider.spec.ts` (4 tests): Provider dialing state transitions (`INITIATED` -> `RINGING` -> `CONNECTED`), timer management, external webhook simulation.

### 3. `@grotec/web` (3 / 3 tests passed)
- `src/lib/format.spec.ts` (3 tests): Currency formatting, date formatting, name abbreviations.

## Build and Static Analysis Verification
- `npm run typecheck`: **Zero TypeScript errors** across `@grotec/shared`, `@grotec/api`, and `@grotec/web`.
- `npm run build`: Production compilation succeeds:
  - `@grotec/shared`: `tsc` compiled to `dist/` (type declarations and JS output).
  - `@grotec/api`: NestJS/SWC production build generated in `dist/`.
  - `@grotec/web`: Vite production bundle created with clean asset chunks in `dist/`.

## Live API Runtime Verification (`http://localhost:3000/api/v1`)
Verified live against embedded PostgreSQL:
- `POST /auth/login`: Authenticated successfully with `founder@grotec.in` and `agent@grotec.in`.
- `GET /hrms/dashboard`: HTTP 200 OK — live headcount, today's attendance stats, pending leaves count, pending payroll alert.
- `GET /employees`: HTTP 200 OK — returned seeded employee roster with HRMS profile metadata.
- `GET /employees/:id/profile`: HTTP 200 OK — returned aggregated 7-tab payload (personal details, CRM KPI performance metrics, attendance history, leave balance, salary revisions, advances ledger, history records).
- `POST /attendance/mark`: HTTP 201 Created — marked single attendance record with manual source and punch timestamp.
- `POST /attendance/bulk`: HTTP 201 Created — marked attendance across employee roster in single batch.
- `POST /attendance/essl/sync`: HTTP 201 Created — biometric punch ingestion simulated and recorded with source `ESSL`.
- `POST /attendance/:id/approve`: HTTP 200 OK — manager approved attendance record with audit trail.
- `POST /leave/apply`: HTTP 201 Created — submitted leave application.
- `POST /leave/:id/approve`: HTTP 200 OK — manager approved leave, deducted employee leave quota, and generated `ON_LEAVE` attendance records.
- `POST /payroll/generate`: HTTP 201 Created — calculated monthly payroll run pro-rated to 30-day basis with loss-of-pay deductions and advance recovery.
- `POST /payroll/:id/approve`: HTTP 200 OK — locked payroll run preventing further modifications.
- `POST /payroll/:id/publish`: HTTP 200 OK — published run, deducted advance running balance, and released payslips.
- `POST /payroll/salary-revisions`: HTTP 201 Created — append-only revision created without modifying historical records.
- `POST /kpi/freeze/:employeeId/:period`: HTTP 200 OK — snapshot score frozen for historical immutability.
- `GET /notifications`: HTTP 200 OK — retrieved real-time notifications queue.

## Live Frontend UI Verification (`http://localhost:5173`)
Verified in browser:
- Navigation Shell: PRD §6.1 order confirmed (Dashboard, Agent, Relationship Manager, Knowledge Base), plus HRMS & Operations NavGroup.
- Top Header: User role badge, Quick Switcher, and `NotificationCenter` drawer with unread count indicator.
- All HRMS pages accessible: `/hrms/dashboard`, `/hrms/employees`, `/hrms/employees/:id`, `/hrms/attendance`, `/hrms/leave`, `/hrms/payroll`, `/hrms/payslips`, `/hrms/kpi`.

