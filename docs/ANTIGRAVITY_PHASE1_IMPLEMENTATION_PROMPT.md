# GROTEC FarmerOS — complete Phase 1 web implementation

## Execution contract for the coding agent in Google Antigravity

Implement the full Phase 1 web application in the supplied GROTEC project: CRM, HRMS, ESSL attendance integration, CRM-to-HRMS performance/KPI integration, and the shared infrastructure supporting them. Read this entire document, including its embedded source appendices, before building the requirement matrix. Then modify the actual code and verify the result. A plan, UI mockup, audit alone, or frontend connected to fake data is not the deliverable.

“Antigravity” here identifies the development tool. It is not a GROTEC domain model or a request to implement a gravity algorithm. Use the model and capabilities available in the current development session; do not claim access to files, previous chats, browser tools, providers, or credentials that you do not actually have.

This execution contract resolves weaknesses and ambiguities in the older master prompt reproduced below. The appendices preserve its details and the supplied requirements; they are not separate requests to change tools or abandon this task.

## 1. Inputs, authority, and existing work

Inputs:

- The supplied `grotec project.zip`, representing the supplied implementation baseline.
- The project opened in the workspace, if already extracted. Compare it with the ZIP before assuming they are identical; preserve subsequent work and explain material differences. Do not overwrite an existing working directory with the ZIP.
- Appendix A: the complete user-supplied 51-section master implementation prompt.
- Appendix B: the complete user-supplied HRMS/Phase 1 excerpt.
- Appendix C: the project’s extracted PRD reference, including the missing CRM and role details.
- Other actually available approved specifications in the project. Do not presume access to prior conversations. If a referenced specification is unavailable, record exactly what is missing and continue independently implementable work.

Priority: latest explicit user decisions, this execution contract, supplied Phase 1 requirements and PRD, older supporting briefs, then existing code/documentation. Record any unresolved requirement conflict rather than silently picking whichever is easiest. Existing implementation notes are evidence of current behavior, not proof of required behavior.

The inspected project is an npm workspace with `apps/web` (React/Vite/Tailwind), `apps/api` (NestJS/Prisma), `packages/shared`, and PostgreSQL infrastructure. Verify that against the supplied baseline. Preserve the stack and correct existing work unless a specific requirement proves a change necessary.

The existing README says HRMS/payroll are excluded and describes a CRM-only monthly build. That restriction is superseded by this request for full Phase 1. Update obsolete scope documentation as part of implementation. Do not use old month-by-month milestones to stop after CRM.

The extracted PRD has a v2.0 cover, v2.1 document-control/footer text, and draft/sign-off language. Disclose this inconsistency. This instruction authorizes implementation of the supplied requirements; it does not constitute confirmation of unresolved payroll policy, provider selection, or production business acceptance.

Preserve unrelated local changes. Do not reset a real database or modify raw PostgreSQL data files. Use migrations and an isolated test database. Do not expose secrets in logs, reports, code, or browser assets.

## 2. Scope and details that must not be lost

Build every mandatory Phase 1 detail in the appendices, down to individual fields, transitions, filters, permissions, histories, notifications, reports, and invariants. Optional items remain optional; future-phase references remain context.

Phase 1 excludes full sales transactions, inventory, purchasing, dispatch/transport, accounting, P&L, Founder Control Tower, monetary PRI/incentives, WhatsApp chatbot/full automation, and AI-assisted features. Required automatic product messages are in scope despite full WhatsApp automation being deferred. Existing AI Assistant code is not evidence that AI belongs in Phase 1. Preserve unrelated code, but make the delivered Phase 1 navigation and scope compliant and document any feature gating.

Explicit CRM checks:

- CRM top-level information architecture is Dashboard, Agent, Relationship Manager, Knowledge Base, in that order, with access governed by the role matrix. Do not replace it with a generic customer-table application. Surface any conflict between the indicative role matrix and existing RM route permissions for a decision; do not invent a fifth RM login role.
- Implement the Agent workspace before deriving dashboard widgets. It is a full-screen calling workspace with dial controls, live integration state, customer context, history, notes, outcome, and next action together. Creating/completing an unknown customer must not interrupt the call.
- Dashboard includes today's assigned calls, pending and overdue follow-ups, new leads, interested and converted customers, completed calls, reminders, and recent activity, scoped to the agent's workload. Detailed widget decisions remain configurable where deferred.
- Customer context includes name, primary/alternate mobile, village/taluk/district/state, crops/acreage, source, interactions, interest and follow-up history. Existing order context appears only if a legitimate source exists.
- Exactly three business outcomes: Interested, Not Interested, Not Answered. Interested requires a modal with exactly one of Callback or Sales before saving. Callback asks only for date, time, and reason/note; link customer, call/lead, and agent automatically from context. Not Interested has no Callback/Sales modal. Not Answered records the attempt without invented automatic redial rules.
- Provider call states are a separate concept from those three fixed outcomes. Configurable statuses must not introduce a fourth business outcome or merge outcome with next action.
- Sales is CRM progression and RM handover, not a Phase 2 transaction engine. Preserve separate agent and RM ownership and historical attribution.
- RM workspace supports My Customers, follow-ups, customer details, relationship/interaction history, and notes with authorized ownership controls.
- Knowledge Base supports crop/problem browsing, keywords/symptoms, typeahead search, linked solutions/products/brands and usage guidance, plus authorized, audited content management. Do not invent agronomic recommendations or substitute an AI chatbot for the required search.

Explicit role checks:

- Four Phase 1 login roles: Founder, Manager/Admin, Telecaller/Agent, Staff.
- Founder has full CRM/HRMS/payroll and restricted audit/security/system controls.
- Manager/Admin has broad operational CRM/HRMS/payroll, reports and approvals; do not reduce this to payroll preparation. Manager KPI configuration is marked Partial in the PRD and needs a precise configurable boundary.
- Agent has assigned CRM workload and Knowledge Base search, with no sensitive payroll/HR access; own-attendance access is described in the indicative matrix and must not become unrestricted HRMS administration.
- Staff has assigned employee/office scope, attendance/leave and payroll preparation, with final boundaries pending. Do not infer approval/publication power from preparation access.
- Enforce permissions and record ownership on backend reads, writes, exports, document downloads and aggregate metrics as well as routes and buttons. Use explicit provisional configuration and least privilege for unresolved boundaries; do not label them approved policy.

## 3. Resolve contradictions visibly

Product-message trigger: PRD §6.3.10 and notifications say automatic sending on Interested; the Sales branch and representative acceptance criteria explicitly mention sending on Sales. Do not silently narrow the requirement to Sales-only or send duplicates from both paths. Implement one durable, idempotent notification event path and a configurable trigger policy covering these alternatives. Ask a focused question about Callback versus Sales eligibility; keep unconfirmed production sending disabled and label the policy pending until resolved. Prove both configurable paths in isolated tests.

Revenue: show an unavailable/pending-source state when no approved Phase 1 revenue source exists. Never display fabricated zero as measured revenue, derive revenue from interest alone, or silently build Phase 2 sales. Implement the metric contract and record the missing source.

Identity: one employee business identity spans both modules. A separate authentication credential/session entity linked to that employee is acceptable; duplicate CRM and HRMS people are not. Migrate relationships without breaking current call attribution, ownership, or access.

Historical preservation means append-only salary revisions, retained histories, and immutable finalized period results. It does not prohibit authorized editing of current customer contact details with audit history. KPI draft configuration may be editable, but configurations used to compute period scores must be snapshotted/frozen as required; future settings must not rewrite those scores.

Clarify genuinely undefined calculation policies such as KPI conversion denominators, attribution periods, zero targets, missing metrics and score weighting. Make policy boundaries explicit, use clearly labeled test fixtures, and do not pass unconfirmed defaults off as GROTEC rules.

## 4. Durable requirement accounting and completion gates

Create `docs/phase1/requirements-matrix.md` before substantial changes. Give every atomic requirement a stable ID and include source/section, requirement text, mandatory/optional/future classification, initial state, affected UI/API/service/schema, acceptance test, current status, evidence, and any dependency/decision reference. Do not bury multiple unrelated requirements in a single “HRMS complete” row.

Statuses: NOT ASSESSED, MISSING, INCORRECT, PARTIAL, IMPLEMENTED UNVERIFIED, VERIFIED, BLOCKED EXTERNAL, OPEN DECISION, OPTIONAL, OUT OF SCOPE. “VERIFIED” requires actual evidence; the existence of a file, screen, endpoint, table, or mock is insufficient.

Maintain `docs/phase1/decisions-and-blockers.md`, `docs/phase1/test-evidence.md`, and `docs/phase1/progress.md`. Persist completed IDs, remaining IDs, commands/results, schema decisions and next actions so work can resume without dropping requirements if the session ends. Do not equate session limits, hard work, or remaining coding effort with external blockers. If tools or runtime limits prevent verification, report that as an environment limitation or unverified work explicitly.

Implement in complete UI-to-database slices, keeping the application runnable. Make required routes discoverable in navigation and usable on desktop and mobile. Every required action must persist, survive refresh and enforce permissions. Verify loading, empty, error, validation, success, disabled and retry states; failures must not look like successful empty data.

## 5. Integration and data integrity standards

Use internal adapters for SIM-based third-party auto-dial/call status, ESSL punches and outbound messaging. Do not substitute a `tel:` link or a fake connected animation for working vendor integration. Never claim an adapter interface plus simulator is a live integration.

Provide clearly separated test/sandbox adapters, configuration validation, connection health, safe failure visibility, durable queued work where needed, retry/replay controls and deduplication. Implement real adapters only against validated provider documentation and available credentials. Authenticate provider events, handle duplicate/out-of-order callbacks, and retain provider identifiers and provenance. Business decisions about automatic redial are separate from safe transport retries.

ESSL processing must preserve raw punches, employee/device mapping, source identifiers and timestamps, multiple punches, exceptions and sync status. Manual corrections retain the original source and correction actor. Neither raw punches nor pending attendance can silently bypass approval into payroll. Unconfirmed shift/day-boundary and attendance rules must be explicit policy dependencies.

Use database constraints and transactions, not just frontend checks, to protect normalized phone uniqueness, shared employee identity, separate ownership, valid outcome/next-action combinations, salary append-only history, KPI snapshots and payroll locks. Preserve existing foreign-key links in migrations.

Payroll uses precise money arithmetic and explicit rounding/currency rules; document unconfirmed business policy. Snapshot the effective salary revision, approved attendance/leave inputs, calculation rules, advances/recoveries and resulting totals used by each run. Regeneration before approval must not double-recover advances; concurrent approval/publication must not create duplicate effects. Published payslips derive from locked snapshots. Later salary/attendance edits must not silently mutate locked payroll. Handle corrections through an explicit auditable policy, without inventing an unauthorized unlock mechanism.

Implement all required leave balances/quotas/carry-forward and paid/unpaid classification with approval history; guard overlapping requests and concurrent balance consumption according to documented policy. Include holidays, approved leave, half-days, joining/status changes and salary effective-date boundaries in calculation tests; identify missing policy rather than assuming it.

Capture audit actor, timestamp, action, affected record and appropriate before/after changes without leaking credentials. Protect audit history and authorized access. Store employee documents privately with validated upload types/sizes and authorized download access. Protect payroll and employee data in exports as well as screens.

## 6. Verification is part of implementation

Inspect actual package scripts before choosing commands. Run the applicable shared/API/web builds, type checks, lint, unit tests, integration tests, API authorization tests, database/migration tests and browser end-to-end workflows. An absent script or an `--if-present` skip is NOT a pass. Record command, exit result, test count, environment and evidence; distinguish failures from tests not run.

Test against an isolated real PostgreSQL database. Verify fresh migrations and upgrade of representative existing data. Check record persistence after refresh/restart and review indexes for relevant search and aggregation paths.

At minimum, execute every acceptance criterion and functional workflow from Appendix A and the PRD. Add negative and concurrency tests where important: duplicate primary/alternate phone creation, cross-user record access, unauthorized export/payslip access, invalid Interested combinations, duplicate call events/messages, unauthorized reassignment, duplicate/invalid/missing ESSL punches, rejected or pending attendance excluded from payroll, duplicate advance recovery, attempts to mutate salary history/frozen KPI settings/locked payroll, and repeated payroll approval/publication.

Compare displayed CRM metrics to persisted events and employee attribution, not to seed constants. Verify historical KPI scores and published payroll remain unchanged after future configuration revisions. Test real payslip PDF generation and report downloads for correct source data and access control.

Open the actual application in a browser if available. Test direct links, refresh, navigation, all four roles, form submission, permission failures and representative desktop/mobile widths. If browser verification is unavailable, say so; do not invent screenshots or claim manual testing. Run the backend too: a static frontend preview is not full-stack verification.

Repeat affected checks after fixes, then perform a fresh requirement-by-requirement review against the source text. A second review by the same coding agent is a self-review, not independent external assurance. Do not call it an independent audit unless another actual reviewer performs it.

No source states measurable latency, uptime, retention or concurrency commitments. Record measured results and propose explicit acceptance targets for agreement; never invent contractual performance guarantees.

## 7. Delivery and honest final verdict

Deliver changed source, migrations, configuration examples without secrets, isolated demo/test fixtures, tests, working web/API startup instructions, and updated technical documentation. Provide a reviewable build with URLs/ports and deployment configuration appropriate to the existing project. Public deployment and live provider testing require the actual target/configuration and authorization; local running is not proof of production deployment.

Provide a concise final report linking the full matrix and evidence. Include changes, verified IDs/counts by module, unverified or incomplete IDs, real blockers with required owner/input, unresolved business decisions, exact test results and known regressions. Do not give a reassuring percentage without a defined denominator and per-requirement evidence.

Use these final verdicts:

- COMPLETE: every mandatory Phase 1 requirement is verified, including live required integrations and confirmed production business policies; no required unresolved items remain.
- IMPLEMENTATION READY — EXTERNAL VALIDATION PENDING: all independently implementable mandatory behavior is verified, but named provider/policy/UAT items prevent full Phase 1 acceptance. This is not COMPLETE or production-ready.
- PARTIALLY COMPLETE: any mandatory implementation or required verification remains unfinished beyond those external dependencies.
- NOT COMPLETE: substantial required workflows are absent or nonfunctional.

Do not use the older phrase “COMPLETE WITH EXTERNAL DEPENDENCIES” to imply acceptance of missing required live integrations. Keep implementing authorized, feasible work until no such work remains. Ask only specific questions whose answers are absent, preserve those decisions as pending, and continue unrelated work.

Begin by inspecting the supplied project and embedded requirements, recording the initial matrix, then implementing the highest-priority incomplete end-to-end workflow. Do not stop after explaining this process.

---

# Embedded source requirements

The following appendices preserve the supplied material for detailed coverage. Follow the execution contract above for source conflicts, unavailable prior context, open decisions, future scope and honest completion reporting.


# Appendix A — Original master implementation prompt (complete)


# GROTEC FarmerOS — PHASE 1 MASTER IMPLEMENTATION PROMPT

## CRM + HRMS — COMPLETE REQUIREMENT-TO-IMPLEMENTATION AUDIT, FIX, COMPLETE & VERIFY

You are working on **GROTEC FarmerOS — Phase 1**.

Phase 1 includes BOTH:

1. **CRM Module**
2. **HRMS Module**
3. **CRM ↔ HRMS integration**
4. Shared authentication, employee identity, permissions, auditability, notifications, integrations, and supporting infrastructure required for both modules.

I am providing you with the **latest ZIP of the implementation currently built so far**.

Treat that ZIP as the **CURRENT STATE OF THE ACTUAL IMPLEMENTATION**.

You ALREADY have the CRM requirements, PRD, specifications, architecture, navigation structure, feature requirements, business rules, UI requirements, data requirements, and other CRM information that I previously provided in this conversation.

You also have the Phase 1 HRMS requirements/specification.

**DO NOT ask me to resend or repeat requirements that I have already provided.**

Your job is NOT to create a plan.

Your job is to **inspect the current implementation, compare it against the complete Phase 1 requirements, and ACTUALLY MODIFY THE CODEBASE until Phase 1 is fully compliant.**

---

# 1. SOURCE OF TRUTH — VERY IMPORTANT

Use the following priority order when evaluating requirements:

### SOURCE 1 — Latest explicit requirements/specifications I provided

These are authoritative.

### SOURCE 2 — Finalized Phase 1 PRD/specification

Use it as authoritative for Phase 1 CRM + HRMS requirements unless a later explicit requirement from me overrides it.

### SOURCE 3 — Existing implementation

The ZIP is NOT the source of truth.

The ZIP represents only the **current implementation state**.

If the existing implementation conflicts with the requirements, **the requirements win**.

### SOURCE 4 — Your own assumptions

Do NOT use assumptions to replace requirements.

Do NOT redesign the product simply because you personally prefer another architecture.

---

# 2. ABSOLUTELY NO BIASED AUDIT

I want an **objective engineering audit**, not a positive assessment of the existing code.

Do NOT assume something is complete because:

* a page exists
* a button exists
* a form exists
* a database table exists
* an API route exists
* mock data appears
* a UI card displays a value
* a component has the correct name
* navigation contains the expected item
* a feature appears visually functional

A requirement is considered **IMPLEMENTED** only when the complete underlying behavior works.

For example:

If the UI shows "Calls Dialed", verify:

UI → API → service/business logic → database → employee relationship → CRM activity → aggregation → returned value → UI.

If any critical connection is missing, mark it incomplete and fix it.

Do not give credit for superficial implementations.

---

# 3. REQUIRED WORKFLOW

Follow this process internally:

## STEP 1 — FULL CODEBASE INSPECTION

First inspect the entire ZIP/codebase.

Understand:

* project structure
* frontend
* backend
* API routes
* database
* ORM/schema
* authentication
* authorization
* shared components
* CRM
* HRMS
* integrations
* services
* background jobs
* notifications
* configuration
* migrations
* seed data
* tests
* routing
* state management
* validation
* error handling

Do NOT start modifying files before understanding the existing architecture sufficiently.

---

# STEP 2 — BUILD A REQUIREMENT MATRIX

Create an internal requirement matrix covering **EVERY requirement**, not merely major features.

For every requirement classify it as:

* COMPLETE
* PARTIAL
* INCORRECT
* MISSING
* BLOCKED BY EXTERNAL DEPENDENCY
* OPEN BUSINESS DECISION

For every PARTIAL / INCORRECT / MISSING requirement:

**ACTUALLY FIX OR IMPLEMENT IT.**

Do not merely report it.

---

# STEP 3 — CRM COMPLETE AUDIT

Compare the implementation against **ALL CRM requirements previously provided by me**.

Audit every layer:

### CRM navigation / information architecture

Verify:

* navigation structure
* page hierarchy
* routes
* page access
* breadcrumbs where required
* role-specific navigation
* correct placement of CRM features

### CRM Dashboard

Verify all required:

* metrics
* widgets
* filters
* quick actions
* activity information
* follow-ups
* operational states
* loading states
* empty states
* error states

Do not invent metrics where the requirement is deliberately open.

---

# 4. CRM CUSTOMER / FARMER MANAGEMENT

Verify the complete Customer/Farmer implementation.

Check:

* customer identity
* contact information
* phone numbers
* location
* village
* taluk
* district
* state
* crop
* acreage
* source/lead information
* ownership
* assigned agent
* Relationship Manager
* customer history
* notes
* interactions
* calls
* follow-ups
* search
* filters
* sorting
* CRUD
* duplicate detection
* validation
* reassignment rules
* permissions
* history preservation

### Critical invariant

**Lead/Agent ownership and Relationship Manager ownership are separate relationships.**

Never collapse them into one field.

---

# 5. CRM CALL / AGENT WORKFLOW

Audit the complete telecaller workflow.

Verify:

* auto-dial integration abstraction
* customer lookup
* customer context
* active-call experience
* call status
* call history
* agent assignment
* customer creation when no match exists
* duplicate phone-number detection
* notes
* call outcome
* next action
* follow-up
* history

### CRITICAL DATA RULE

**Call Outcome and Next Action MUST be separate fields.**

Never combine them into one status field.

---

# 6. CALL OUTCOMES

Where the requirements specify exactly three selectable call outcomes, ensure exactly those required outcomes are implemented.

Verify:

* correct selectable values
* outcome persistence
* outcome history
* branching behavior

For **Interested**:

It MUST branch into a mandatory single choice:

* Callback
* Sales

Do not allow invalid combinations.

---

# 7. CALLBACK FLOW

Verify:

Interested → Callback

creates a real Follow-up containing:

* date
* time
* reason
* linked customer
* linked call/lead
* assigned agent

Verify:

* persistence
* retrieval
* editing where allowed
* completion
* history
* reminders/notifications
* permission checks

Do not use placeholder functionality.

Do NOT invent automatic "Not Answered" retry behavior because that business rule has not been finalized.

---

# 8. SALES FLOW / RELATIONSHIP MANAGEMENT

Verify:

Interested → Sales

correctly triggers:

* Relationship Manager ownership assignment
* required ownership workflow
* ownership restrictions
* product-detail communication

Other telecallers must NOT be able to arbitrarily reassign a customer already owned by an authorized Relationship Manager.

Do not invent a separate RM login role if the requirements defer that decision.

Design the implementation so the role can be introduced later without restructuring the entire system.

---

# 9. KNOWLEDGE BASE

Audit the complete Knowledge Base.

Verify:

* crop browsing
* problem browsing
* crop/problem search
* typeahead behavior
* solution/product lookup
* recommended product
* product/brand mapping
* usage guidance
* linked problems
* content management
* permissions
* audit logging
* loading states
* empty states
* error states

Search must be suitable for fast use during a live call.

Do NOT invent agronomic content.

GROTEC-provided crop/problem/solution content remains the authoritative content.

---

# 10. HRMS MODULE

Implement and verify the complete Phase 1 HRMS.

HRMS coverage includes:

* HRMS Dashboard
* Employee Management
* Employee Profile
* Attendance
* Leave Management
* Payroll
* Salary Revisions
* Salary Structure
* Advances & Recoveries
* Monthly Payroll
* Payslips
* Payroll Reports
* Employee History
* CRM Performance & KPI integration

---

# 11. HRMS DASHBOARD

Implement a real-time organizational snapshot containing:

* Total Employees
* Present Today
* Pending Leave Requests
* Pending Payroll Approvals
* Today's Attendance
* Pending Approvals

Quick actions:

* Mark Attendance
* Apply Leave
* Run Payroll

These must use real backend data.

No fake/static metrics.

---

# 12. EMPLOYEE MANAGEMENT

Employee list MUST support:

* search
* sort
* department filter
* status filter
* designation filter

Required columns:

* Employee ID
* Name
* Department
* Designation
* Joining Date
* Experience
* Status
* Actions

Add/Edit Employee must be structured into:

### Personal Information

* Name
* Phone
* Email
* Address

### Employment Details

* Employee ID
* Designation
* Department
* Reporting Manager
* Joining Date
* Experience
* Status

### Documents

### Notes / Remarks

Implement complete validation, persistence, permissions and error handling.

---

# 13. EMPLOYEE PROFILE

Employee Profile MUST contain seven areas:

1. Overview
2. Performance
3. Attendance
4. Leave
5. Salary & Payslips
6. Advances
7. Training & History

Overview must expose:

* contact details
* employment details
* current salary snapshot
* Employee ID
* joining date
* department
* designation
* status
* experience

Quick actions:

* Edit Profile
* Mark Attendance
* Apply Leave
* View Payslips

---

# 14. CRM ↔ HRMS SHARED EMPLOYEE IDENTITY

THIS IS A CRITICAL ARCHITECTURAL REQUIREMENT.

There must be:

**ONE employee identity shared across CRM and HRMS.**

A telecaller is an Employee.

There must NOT be:

* separate CRM employee records
* duplicate HRMS employee records
* separate CRM user identity for the same employee

Required relationship:

Employee
→ Telecaller/Agent
→ CRM Activity
→ Calls / Connections / Leads / Conversions / Revenue
→ HRMS Performance & KPI

CRM activity must flow into HRMS KPI/performance automatically.

No manual re-entry.

Do not build duplicate identity systems.

---

# 15. CRM-LINKED EMPLOYEE PERFORMANCE

Employee Profile → Performance MUST support:

Required metrics:

* Calls Dialed
* Calls Connected
* Leads Converted
* Conversion Rate
* Total Revenue

For Total Revenue:

Do NOT fabricate a revenue source.

The PRD explicitly identifies revenue as a Phase 1 metric while the sales transaction module generating revenue is Phase 2.

Therefore:

* preserve the required metric/interface
* implement the architecture required for future revenue data
* clearly distinguish unavailable/unconfirmed revenue data
* do NOT invent revenue values
* do NOT pretend Phase 2 sales data already exists

Optional metrics may be implemented where supported, including:

* 3-month trend
* 6-month trend
* connected vs dialed
* call-outcome breakdown
* rating
* department rank
* call quality
* responsiveness
* attendance
* monthly breakdown

---

# 16. KPI CONFIGURATION & TRACKING

KPI configuration is Phase 1 functionality.

Targets MUST be configurable by:

* employee
* role
* period
* team

Never hard-code KPI targets.

KPI weights must be configurable for metrics such as:

* calls
* conversion
* CRM discipline/compliance
* customer quality
* attendance

Achievement tracking MUST store:

* actual value
* target value
* achievement percentage

System MUST calculate/store:

* overall configurable performance score
* performance status
* employee
* period

Must support:

* monthly review notes
* coaching actions

### HISTORICAL PRESERVATION

If KPI configuration changes in a future period:

**past KPI scores MUST NOT change.**

KPI targets/configurations must be versioned appropriately.

KPI configuration changes must be auditable.

---

# 17. ATTENDANCE

Implement:

* attendance calendar
* mark entry
* bulk attendance
* correction
* history

Status values:

* Present
* Absent
* Late
* HalfDay
* WeeklyOff
* Holiday
* Leave

Workflow:

Mark Entry
→ Pending
→ Approval
→ Approved

Rejected:

→ Rejected + reason

Attendance approval must retain the complete approval history.

Do NOT store only the current approval status.

---

# 18. ESSL BIOMETRIC INTEGRATION

ESSL is explicitly Phase 1.

Architecture MUST be:

ESSL Device
→ Integration/API/Connector
→ GROTEC Attendance Processing
→ Attendance Records
→ Correction/Approval
→ Payroll

### NON-NEGOTIABLE ARCHITECTURE

ESSL is an attendance INPUT SOURCE only.

GROTEC HRMS remains the system of record for:

* processed attendance
* corrections
* approval status
* leave linkage
* payroll calculations
* attendance history

Support:

* employee-to-device mapping
* punch-in
* punch-out
* date/time
* device/source
* multiple punches per employee/day
* synchronization

Exception handling:

* missing punch
* incorrect punch
* duplicate punch
* invalid punch
* device failure
* network/sync failure

Every attendance record MUST retain its source:

* ESSL
* Manual

ESSL attendance MUST still pass through correction/approval before payroll.

### IMPORTANT OPEN DEPENDENCY

Do NOT invent a final ESSL provider/API if it has not been technically validated.

Build the integration behind an internal abstraction/provider interface so the final provider can be plugged in later.

---

# 19. LEAVE MANAGEMENT

Implement:

* leave types
* leave quotas
* carry-forward
* paid/unpaid classification
* leave balance
* leave application
* approval
* rejection
* leave history
* department filtering
* export/reporting
* approval history

Leave approval history must be retained.

### IMPORTANT

Preconfigured leave types are NOT final business policy until GROTEC confirms them.

Do not hard-code draft leave types as irreversible business rules.

Make them configurable.

---

# 20. PAYROLL

Implement complete Phase 1 payroll architecture.

## Salary Revisions

Salary history MUST be:

* versioned
* effective-dated
* saved-by tracked
* append-only

A new salary revision must NEVER overwrite a previous revision.

---

# 21. SALARY STRUCTURE

Support:

* earnings
* deductions
* amount
* taxable flag
* custom components

Calculate:

* gross
* total deductions
* net payable

Make salary components configurable.

---

# 22. ADVANCES & RECOVERIES

Implement an advance ledger containing:

* employee
* amount
* recovery entries
* running balance
* linked month
* notes

Do not implement this as a superficial UI-only ledger.

---

# 23. MONTHLY PAYROLL WORKFLOW

Implement exactly:

Idle
→ Generate
→ Generated
→ Approve & Lock
→ Approved
→ Publish
→ Published

Payroll record must capture:

* Employee
* Gross
* Deductions
* Attendance adjustment
* Net pay
* Flags/errors
* Approver
* Approval timestamp
* Publication timestamp

Approval MUST lock the payroll run.

Approval and publication MUST be auditable.

Prevent modification after locking except through an explicitly authorized workflow if such workflow is required.

---

# 24. PAYROLL CALCULATION

Calculation must account for:

1. Active / Probation employees
2. Latest effective salary revision
3. Gross earnings
4. Total deductions
5. Approved absent days
6. Approved half days
7. Working-day salary calculation
8. Attendance adjustment
9. Advance recovery
10. Net pay
11. Validation flags

### IMPORTANT

Do NOT invent final statutory payroll policy.

PF / ESI / PT / TDS and exact working-day rules require GROTEC/Finance validation.

Therefore:

* build configurable payroll components/rules
* clearly isolate statutory rules
* do not pretend unconfirmed rules are final
* do not silently hard-code legal assumptions

---

# 25. PAYSLIPS & REPORTS

Payslips:

* published payroll months
* employee search/filter
* payslip list
* month selection
* net pay
* PDF generation/download

Payroll reports:

* monthly payroll cost
* department-wise payroll cost
* payroll totals
* export functionality

Use real payroll data.

---

# 26. EMPLOYEE HISTORY

Implement:

* Training
* Warning
* Commendation
* Promotion

Each record must capture:

* Type
* Date
* Description
* Added by

Preserve history.

---

# 27. NOTIFICATIONS

Implement the notification architecture for:

* follow-up reminders
* automatic product-detail message on Interested
* attendance approval/rejection
* leave approval/rejection
* payroll generated
* payroll approved
* payroll published

Provider/channel remains configurable.

Possible channels include:

* SMS
* WhatsApp Business API
* email

Do NOT lock business logic to one provider.

Build an internal notification abstraction.

Failures must be visible and recoverable.

Never silently swallow integration failures.

---

# 28. EXTERNAL INTEGRATIONS

All external integrations MUST sit behind internal abstractions.

This applies to:

### Auto-Dialer

Confirmed approach:

* third-party auto-dialer
* SIM-based auto-dial
* call-status synchronization

Specific vendor remains TBD.

GoDial is only a candidate, NOT a finalized requirement.

### ESSL

Provider/API remains subject to technical validation.

### Messaging

Provider/channel remains an implementation-design decision.

ARCHITECTURAL RULE:

Changing the external provider must NOT require rewriting CRM/HRMS business logic.

Integration failures must be:

* surfaced
* logged
* recoverable
* observable

No silent failure.

---

# 29. AUDIT & SECURITY

Implement robust auditability.

Founder-restricted areas include:

* complete audit logs
* sensitive security settings
* high-risk system administration
* ownership-level controls
* irreversible administrative actions

Critical actions must record:

* who
* when
* what changed

Audit required for:

* payroll approval
* payroll publication
* attendance approval
* employee status changes
* customer reassignment
* KPI configuration changes
* KPI target changes
* Knowledge Base content changes

Approval workflows must retain history.

---

# 30. RBAC

Role-based access control MUST be enforced:

### At UI level

Users must not see unauthorized functionality where appropriate.

### At API/backend level

Unauthorized requests MUST actually be rejected.

Never rely only on hiding buttons.

Verify all four required roles against the previously provided §5 permissions.

Do not invent permission boundaries that contradict the specification.

Where the Founder vs Manager/Admin boundary is explicitly still open, design the authorization system to support the final decision without architectural rework.

Staff permission boundaries may also remain configurable/deferred where specified.

---

# 31. DATA MODEL

Verify and correct the database/schema.

Required high-level entities include:

* Customer/Farmer
* Lead/Call
* Follow-up
* Relationship Ownership
* Crop
* Problem/Issue
* Solution/Product
* Employee
* Attendance Record
* Leave Application
* Salary Revision
* KPI Target
* Payroll Run
* Advance/Recovery
* Employee History

Enforce important invariants at the DATA LAYER, not only frontend/backend validation.

---

# 32. NON-NEGOTIABLE DATA INVARIANTS

### Invariant 1

Call Outcome and Next Action are separate fields.

### Invariant 2

Lead ownership/Agent and Relationship Manager ownership are separate relationships.

### Invariant 3

One employee identity is shared between CRM and HRMS.

### Invariant 4

Salary revisions are append-only.

### Invariant 5

KPI targets/settings preserve historical period results.

### Invariant 6

Attendance records always retain source.

### Invariant 7

Historical data must not be overwritten.

---

# 33. SINGLE SOURCE OF TRUTH

There must be one authoritative record for:

* Customer
* Employee
* Attendance
* Payroll

Avoid duplicate records created for convenience.

If the existing code has duplicate entities representing the same business object, refactor them carefully rather than building another duplicate layer.

---

# 34. CONFIGURABILITY

Avoid unnecessary hard-coding.

The following should be configurable where required:

* CRM statuses
* leave types
* salary components
* KPI targets
* KPI weights
* teams
* employee targets
* role targets
* payroll components

Do not turn open business decisions into permanent hard-coded behavior.

---

# 35. FRONTEND QUALITY

For every required screen verify:

* correct layout
* correct information architecture
* usable forms
* validation
* loading state
* empty state
* error state
* success state
* responsive behavior
* disabled states
* permission-aware actions
* pagination where appropriate
* search
* filtering
* sorting
* confirmation for destructive/high-risk actions
* consistent navigation
* accessibility basics

Do not accept UI-only placeholders.

---

# 36. BACKEND QUALITY

Verify:

* API routes
* request validation
* response validation
* authorization
* service layer
* business logic
* database queries
* transactions
* error handling
* concurrency-sensitive operations
* locking
* historical preservation
* audit logging
* integration failure handling

Do not merely create endpoints that return mock JSON.

---

# 37. DATABASE QUALITY

Verify:

* schema correctness
* relationships
* foreign keys
* indexes
* uniqueness constraints
* nullable fields
* enum/configuration strategy
* historical records
* audit records
* migrations
* seed data
* cascading behavior
* transaction boundaries

Particularly verify:

* duplicate phone detection
* employee identity uniqueness
* salary revision history
* KPI period immutability
* attendance source
* ownership relationships

---

# 38. ERROR / EMPTY / LOADING STATES

Every major workflow must have proper:

* loading
* empty
* error
* validation
* retry/recovery

Do not let API failures appear as empty datasets.

Do not hide integration failures.

---

# 39. SECURITY AUDIT

Check for:

* unauthorized API access
* privilege escalation
* insecure direct object references
* missing authorization checks
* exposed sensitive employee information
* exposed payroll information
* unsafe file/document access
* unsafe database operations
* missing validation
* client-only permission enforcement
* audit bypass
* ownership bypass
* payroll modification after lock

Fix real security issues discovered during implementation.

Do not weaken security merely to make a workflow easier.

---

# 40. DO NOT INVENT OPEN ITEMS

There are deliberate open decisions in Phase 1.

Do NOT silently resolve them.

Examples include:

* exact auto-dialer vendor
* exact ESSL provider/API
* messaging provider/channel
* "Not Answered" retry behavior
* final Relationship Manager permission role
* Founder vs Manager/Admin restricted-control boundary
* final Staff permission boundaries
* final call-status list
* final leave policy
* final statutory payroll rules
* exact detailed dashboard metrics where deferred
* final agronomic Knowledge Base content

Where an open item blocks production integration, implement the **correct abstraction/interface/configuration boundary** rather than inventing the missing business decision.

---

# 41. PRESERVE CORRECT EXISTING WORK

Do NOT rewrite working functionality unnecessarily.

If something is already correct:

**KEEP IT.**

If partially correct:

**EXTEND/FIX IT.**

If incorrect:

**ALTER IT.**

If missing:

**ADD IT.**

If a later requirement supersedes an earlier implementation:

**UPDATE IT TO THE LATEST REQUIREMENT.**

Do not create duplicate systems when the existing implementation can be extended.

Use the minimum necessary architectural changes.

---

# 42. DO NOT LOWER THE STANDARD TO MATCH THE ZIP

This is extremely important.

The existing implementation may be incomplete.

Do NOT reinterpret the requirements to make the existing implementation appear compliant.

Instead:

CURRENT ZIP
↓
REQUIREMENT COMPARISON
↓
GAP IDENTIFICATION
↓
IMPLEMENTATION
↓
TESTING
↓
RE-COMPARISON
↓
COMPLIANCE

The target is **requirements compliance**, not "making the ZIP look acceptable."

---

# 43. ACTUALLY IMPLEMENT EVERYTHING POSSIBLE

Do not respond with:

* "This needs to be implemented"
* "Future work"
* "You should add..."
* "Consider adding..."
* "This is missing"
* "I recommend..."
* "Here's a plan"

when the functionality can actually be implemented in the current environment.

**IMPLEMENT IT.**

Only identify something as blocked when it genuinely depends on an external decision/provider/credential that cannot be completed without it.

Even then, implement everything around the dependency that CAN be implemented.

---

# 44. TESTING REQUIREMENT

After implementation:

Run the available:

* build
* type checking
* lint
* unit tests
* integration tests
* API tests
* database checks
* route checks

where applicable.

Fix all errors you encounter.

Do not stop at the first error.

---

# 45. MANUAL / FUNCTIONAL VERIFICATION

Verify the actual application flows.

At minimum test:

### CRM

* login
* role access
* dashboard
* customer search
* customer creation
* duplicate customer detection
* customer profile
* call workflow
* call outcome
* Interested → Callback
* Interested → Sales
* follow-up creation
* ownership
* Knowledge Base
* CRM history
* notifications

### HRMS

* employee creation
* employee editing
* employee profile
* attendance
* attendance correction
* attendance approval
* leave application
* leave approval/rejection
* salary revision
* salary history
* salary structure
* advance/recovery
* payroll generation
* payroll approval/lock
* payroll publication
* payslip
* reports
* employee history
* KPI configuration
* KPI achievement
* CRM metrics on employee profile

### Integration

* employee identity shared between CRM and HRMS
* CRM activity flows into KPI metrics
* attendance source preserved
* ESSL abstraction
* notification abstraction
* audit logging
* permissions across modules

---

# 46. ROUTE CHECK

Check every Phase 1 route.

Find:

* broken routes
* missing routes
* incorrect redirects
* unauthorized access
* routes rendering wrong components
* pages crashing on direct navigation
* routes requiring missing parameters
* stale navigation links

Fix them.

---

# 47. API / DATABASE CONSISTENCY CHECK

For every major feature:

Frontend
↓
API
↓
Business logic
↓
Database
↓
API response
↓
Frontend

Verify the complete chain.

Find and fix:

* mismatched field names
* incorrect types
* missing relationships
* stale API contracts
* unused endpoints
* frontend fields not persisted
* backend fields not displayed
* incorrect aggregation
* incorrect joins
* incorrect authorization
* mock responses
* hard-coded metrics

---

# 48. REGRESSION CHECK

Do not break existing functionality while implementing missing requirements.

After modifications:

* rerun tests
* rebuild
* inspect affected screens
* verify existing CRUD
* verify authentication
* verify permissions
* verify database migrations
* verify navigation
* verify integrations

---

# 49. FINAL REQUIREMENT RE-CHECK

After all implementation and testing is complete, perform a SECOND full comparison against:

* every CRM requirement previously provided
* every HRMS Phase 1 requirement
* CRM ↔ HRMS requirements
* navigation requirements
* data model
* business rules
* permissions
* integrations
* notifications
* audit requirements
* non-functional requirements
* assumptions
* dependencies
* open items
* acceptance criteria

Do NOT assume your previous implementation work was correct.

Audit it again.

---

# 50. PHASE 1 ACCEPTANCE CRITERIA

The final implementation must be capable of demonstrating the Phase 1 acceptance criteria, including:

1. Telecaller can auto-dial a customer without manually entering the number and call status is visible.
2. Full customer context — profile, history, notes — is available during an active call.
3. Unknown customer number prompts customer creation with duplicate-number detection.
4. Exactly three required call outcomes are selectable, with Interested branching mandatorily to Callback or Sales.
5. Callback creates follow-up with date, time and reason; Sales triggers RM ownership assignment and automatic product-detail communication.
6. RM ownership prevents unauthorized telecaller reassignment.
7. ESSL punches enter HRMS attendance as a source while HRMS remains the system of record after correction/approval.
8. Salary revisions are versioned and never overwrite previous revisions.
9. Monthly payroll follows Idle → Generated → Approved & Locked → Published with approver/timestamps.
10. RBAC matches the defined roles across CRM and HRMS.
11. CRM-generated performance metrics are visible on Employee Profile.
12. Employee/team KPI targets and weights are configurable and historical scores remain unchanged.
13. Telecaller can search/browse Knowledge Base by crop/problem and view recommended product/solution.

---

# 51. FINAL OUTPUT

After doing the work, give me an objective final report.

Include:

## A. IMPLEMENTATION COMPLETED

What you actually changed.

## B. REQUIREMENT COVERAGE

Break down:

* CRM
* HRMS
* CRM ↔ HRMS
* Security/RBAC
* Audit
* Integrations
* Notifications
* Data model
* Non-functional requirements

## C. REMAINING BLOCKERS

Only list genuine blockers caused by:

* unresolved external provider
* missing credentials
* business decision
* required external dependency

Do NOT call something a blocker merely because it was difficult to implement.

## D. TEST RESULTS

Report:

* build
* lint
* type check
* tests
* route verification
* API verification
* database verification
* major functional workflows

## E. OPEN ITEMS

Explicitly distinguish true PRD open items from implementation gaps.

## F. FINAL COMPLIANCE ASSESSMENT

Give an objective assessment:

* COMPLETE
* COMPLETE WITH EXTERNAL DEPENDENCIES
* PARTIALLY COMPLETE
* NOT COMPLETE

Do NOT inflate the score.

If something is incomplete, say exactly why.

If something is complete, only mark it complete after verifying the underlying implementation.

---

# FINAL INSTRUCTION

**DO NOT JUST REVIEW THE ZIP.**

**DO NOT JUST GIVE ME A GAP ANALYSIS.**

**DO NOT GIVE ME A PLAN INSTEAD OF IMPLEMENTATION.**

**DO NOT ASK ME TO REPEAT THE CRM OR HRMS REQUIREMENTS.**

Take the ZIP as the current implementation, use all previously supplied requirements/specifications as the source of truth, inspect the entire codebase, identify every mismatch, implement every possible missing requirement, correct every incorrect implementation, complete every partial implementation, preserve everything already correct, test the resulting system, and perform a final independent compliance audit.

The end goal is:

**CURRENT ZIP**
↓
**ALL PREVIOUS CRM REQUIREMENTS**
+
**PHASE 1 HRMS REQUIREMENTS**
↓
**COMPLETE REQUIREMENT MATRIX**
↓
**FULL CODEBASE AUDIT**
↓
**IMPLEMENT MISSING FEATURES**
↓
**FIX INCORRECT FEATURES**
↓
**COMPLETE PARTIAL FEATURES**
↓
**INTEGRATE CRM + HRMS**
↓
**VERIFY DATABASE/API/UI**
↓
**SECURITY + RBAC + AUDIT CHECK**
↓
**BUILD + TEST**
↓
**REGRESSION CHECK**
↓
**FINAL REQUIREMENT-TO-IMPLEMENTATION AUDIT**
↓

# COMPLETE PHASE 1 IMPLEMENTATION

Do not lower the requirements to match the existing implementation.

Bring the implementation up to the requirements.



# Appendix B — Supplied HRMS and Phase 1 excerpt (complete)


7. HRMS Module
Coverage. Dashboard, Employee Management, Employee Profile, Attendance, Leave Management, Payroll (salary
revisions, salary structure, advances/recoveries, monthly payroll, payslips, reports), Employee History, and CRM
performance & KPI integration.
7.1 HRMS Dashboard
A real-time organisation snapshot showing Total Employees, Present Today, Pending Leave Requests, Pending
Payroll Approvals, Today's Attendance and Pending Approvals, with quick links to Mark Attendance, Apply Leave
and Run Payroll.
7.2 Employee Management
Employee List — search, sort and filter by department, status and designation. Columns: Employee ID, Name,
Department, Designation, Joining Date, Experience, Status, Actions.
Add / Edit Employee is organised in four sections:
1. Personal Information — Name, Phone, Email, Address
2. Employment Details — Employee ID, Designation, Department, Reporting Manager, Joining Date, Experience,
Status
3. Documents
4. Notes / Remarks
7.3 Employee Profile
The employee profile presents seven areas: Overview, Performance, Attendance, Leave, Salary & Payslips,
Advances, Training & History.
Overview shows contact details, employment details, current salary snapshot, Employee ID, joining date,
department, designation, status and experience, with quick actions for Edit Profile, Mark Attendance, Apply Leave
and View Payslips.
7.4 Employee Performance & KPI Integration (CRM ↔ HRMS)
This section is the bridge between the two modules, and is the reason KPI tracking sits in Phase 1.
7.4.1 CRM-Linked Metrics on the Employee Profile
Required: Calls Dialed, Calls Connected, Leads Converted, Conversion Rate, Total Revenue.
Optional: 3-month and 6-month trend views; connected-vs-dialed breakdown; call-outcome breakdown; rating,
department rank, call quality, responsiveness, attendance, monthly breakdown.
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 13 of 25
Requires confirmation. Total Revenue is listed as a Phase 1 metric, while the sales transaction module that would
generate revenue is Phase 2 scope (§4.2). The source of the Phase 1 revenue figure needs confirmation. It has been
left exactly as stated rather than changed.
7.4.2 KPI Configuration & Tracking (Phase 1 Scope)
• Employee and team targets must be configurable by employee, role, period or team — never hard-coded.
• KPI weights across metrics (e.g. calls, conversion, CRM discipline/compliance, customer quality, attendance)
must be configurable and adjustable for future periods.
• Achievement tracking must record actual value vs. target and achievement percentage.
• The system must produce an overall configurable performance score/status per employee per period.
• The system must capture monthly review notes and coaching actions.
• Historical KPI scores must remain unchanged if KPI settings are modified in a later period — the same
historical-preservation principle used for salary revisions (§7.8.1).
• KPI and target configuration changes must be auditable (§10).
7.4.3 Forward Compatibility
Additional metrics such as collection performance and repeat business will layer onto this KPI framework once
Phase 2 Sales data is available. This KPI foundation feeds directly into the Phase 3 PRI/incentive engine and
Founder Control Tower rollups (§19): Phase 1 delivers configuration and tracking, Phase 3 adds the monetary
incentive calculation and cross-business aggregation.
7.5 Attendance
• Attendance calendar, mark entry, bulk attendance, correction and history.
• Status values: Present, Absent, Late, HalfDay, WeeklyOff, Holiday, Leave.
• Attendance approval must retain approval history, not just current status (§10).
Mark Entry → Pending → Approval → Approved
 │
└────→ Rejected + reason
7.6 ESSL Biometric Integration
Explicitly in Phase 1. Purpose: eliminate manual daily attendance entry.
ESSL Biometric Device
 ↓
ESSL Integration / API / Connector
 ↓
GROTEC Attendance Processing
 ↓
Attendance Records
 ↓
Correction / Approval
 ↓
Payroll
7.6.1 Architecture Rule (Non-Negotiable)
ESSL is an attendance input/source only. GROTEC HRMS remains the system of record for processed attendance,
corrections, approval status, leave linkage, payroll calculations and attendance history.
7.6.2 Integration Capability Required
• Employee-to-device mapping
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 14 of 25
• Punch-in and punch-out events with date/time and device/source
• Multiple punches per employee per day
• Attendance synchronisation from device to HRMS
7.6.3 Exception Handling Required
• Missing punch
• Incorrect punch
• Duplicate or invalid punch
• Device or network sync failure
Attendance records must retain their source (ESSL or manual), so a processed record can always be traced back to
its origin. ESSL-sourced attendance still passes through the correction and approval flow in §7.5 before reaching
payroll.
Open item. The final ESSL integration method, API and provider must be technically validated before
implementation. Treat this as an open dependency (§15).
7.7 Leave Management
• Leave types, leave quotas, carry-forward, and paid/unpaid classification
• Leave balance, leave application, approval/rejection and leave history
• Department filtering and export/reporting
• Leave approval must retain approval history, not just current status (§10)
Open item. Preconfigured leave types exist in the HRMS source documentation, but must be confirmed with
GROTEC before being treated as final business policy. Do not hard-code them as final without sign-off.
7.8 Payroll
7.8.1 Salary Revisions
Salary history is versioned, with effective dates and saved-by information. A new salary structure must never
overwrite previous revisions — salary revision storage is append-only.
7.8.2 Salary Structure
Earnings, deductions, amount, taxable flag and custom components, with computed gross, total deductions and
net payable.
7.8.3 Advances & Recoveries
An advance ledger with recovery entries, running balance, linked month and notes.
7.8.4 Monthly Payroll Workflow
Idle → Generate → Generated → Approve & Lock → Approved → Publish → Published
A payroll record captures: Employee, Gross, Deductions, Attendance adjustment, Net pay, Flags/errors, Approver,
Approval timestamp, Publication timestamp. Approval locks the payroll run, and both approval and publication
are auditable (§10).
7.8.5 Payroll Calculation
The calculation concept, per the existing HRMS specification:
1. Active / Probation employees
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 15 of 25
2. Latest effective salary revision
3. Gross earnings, total deductions
4. Approved absent days, approved half days
5. Working-day salary calculation
6. Attendance adjustment
7. Advance recovery
8. Net pay
9. Validation flags
Open item. The exact statutory/legal payroll rules — PF / ESI / PT / TDS treatment, working-day factor, and similar
— must be validated with GROTEC/finance before production. The current specification uses a standard workingday factor and configurable components; this is not yet confirmed as final legal/payroll policy.
7.8.6 Payslips & Reports
Payslips — published payroll months, employee search/filter, payslip list, month selection, net pay display, PDF
download.
Payroll reports — monthly payroll cost, department-wise payroll cost, payroll totals, all exportable.
7.9 Employee History
Training, Warning, Commendation and Promotion records, each capturing Type, Date, Description and Added by.
The structure supports future performance and HR reporting.
8. CRM ↔ HRMS Integration
A common employee identity is shared across both modules — there are no duplicate employee records. A
telecaller is an employee record, not a separate CRM user record.
Employee → Telecaller/Agent → CRM Activity
 ↓
 Calls / Connections / Leads / Conversions / Revenue
 ↓
 HRMS Performance & KPI
CRM activity flows to the HRMS performance and KPI layer without manual re-entry. This enables Phase 1 KPI
tracking today, and future Phase 3 PRI/incentive and Founder Control Tower calculations, without rebuilding
employee identity later.
9. Notifications
• Follow-up reminders, generated from Callback scheduling (§6.3.7)
• Automatic product-detail message on an Interested outcome (§6.3.10)
• Attendance and leave approval notifications — approved / rejected
• Payroll status notifications — generated / approved / published — as applicable to Manager/Admin/Staff
Open item. The exact channel and provider for each notification type is an implementation-design decision (see
§6.3.10).
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 16 of 25
10. Audit & Security
• Founder-restricted: complete audit logs, sensitive security settings, high-risk system administration,
ownership-level controls, irreversible administrative actions.
• Critical actions must be traceable — who, when, what changed.
• Role-based access must be enforced on every module per §5.
• Approval workflows (attendance, leave, payroll) must retain approval history, not just current status.
Actions requiring an audit trail: payroll approval and publication; attendance approval; employee status changes;
customer reassignment; KPI and target configuration changes; Knowledge Base content changes.
11. Data Model — High-Level Entities (Phase 1)
Entity Key attributes and relationships
Customer / Farmer Identity, contact, location (village / taluk / district / state), crop, acreage, source/lead
info
Lead / Call Linked to Customer; outcome; next action; follow-up
Follow-up Date, time, reason; linked to Lead/Call and to Agent
Relationship Ownership Customer → assigned Relationship Manager
Crop Name, category
Problem / Issue Type, symptoms/keywords, linked crop(s)
Solution / Product
Reference
Linked problem(s), recommended product/brand, usage guidance
Employee Identity, employment details, documents, reporting manager
Attendance Record Employee, date, status, source (ESSL / manual), approval state
Leave Application Employee, type, dates, status, approval history
Salary Revision Employee, effective date, components, saved-by — append-only, versioned
KPI Target Employee/team, period, metric, target value, weight — versioned, immutable per
period once set
Payroll Run Month, employee, gross, deductions, net, status, approver, timestamps
Advance / Recovery Employee, amount, linked month, running balance
Employee History Record Employee, type, date, description, added-by
11.1 Data Model Invariants
These constraints follow from requirements elsewhere in this document and must be enforced at the data layer,
not only in application code:
• Call Outcome and Next Action are stored as separate fields; they must never be collapsed into one status
column.
• Lead ownership (Agent) and relationship ownership (RM) are separate relationships on the Customer entity.
• One employee identity is shared by CRM and HRMS; there is no separate CRM user entity.
• Salary Revision is append-only.
• KPI Target is immutable for a period once that period's scores are computed.
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 17 of 25
• Attendance Record always retains its source.
12. API & Integration Requirements
Integration Status Requirement
Auto-Dialer Approach confirmed;
vendor TBD
SIM-based auto-dial and call-status sync via a third-party auto-dialer
integration. Specific vendor TBD — GoDial is one candidate.
ESSL
Biometric
Provider and method
TBD
Device/API connector for punch-data ingestion. Final provider/method TBD;
technical validation required before implementation.
Outbound
messaging
Channel/provider
TBD
Required for the automatic product-detail send on an Interested outcome.
Channel/provider TBD — SMS, WhatsApp Business API or email — an
implementation-design decision.
Two rules apply across all three: each external integration must sit behind an internal abstraction, so a change of
vendor does not require changes to CRM or HRMS business logic; and integration failures must be surfaced and
recoverable, not silent.
13. Non-Functional Requirements (Baseline)
• Access control — role-based access control enforced at both API and UI level.
• Historical preservation — historical data (salary revisions, KPI targets and scores, attendance, call history)
must be preserved, not overwritten.
• Single source of truth — one authoritative record for Customer, Employee, Attendance and Payroll data.
• Configurability — salary components, leave types, CRM statuses, KPI targets and weights must avoid
unnecessary hard-coding.
• Auditability — critical actions are auditable per §10.
• Search responsiveness — Knowledge Base search must be fast enough for typeahead use during a live call.
Note. This is a baseline set. Measurable service-level targets — page-load time, dial latency, concurrent-user load,
uptime, data-retention periods — are not specified in the source material and are not invented here. They should
be agreed and appended before the build is contracted against them.
14. Assumptions
• Auto-dial will use a third-party auto-dialer (confirmed approach). The specific vendor and the final ESSL
provider/API will be selected during technical/integration planning, and are not fixed by this PRD.
• Statutory payroll rules (PF / ESI / PT / TDS, working-day factor) require confirmation with GROTEC/finance
before production payroll runs.
• Preconfigured leave types from the existing HRMS documentation are draft values, pending GROTEC businesspolicy confirmation.
• Relationship Manager may or may not become a distinct permissioned role — the decision is deferred to
Phase 2 planning.
• "Not Answered" automatic retry behaviour is an open business-rule decision, not yet finalised.
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 18 of 25
• Knowledge Base crop/problem/solution content — which product treats which problem — will be provided
and maintained by GROTEC. The platform provides the search and structure, not agronomic authority over
the content.
15. Dependencies
Phase 1 delivery depends on the following being resolved by GROTEC or by joint technical planning. Each has
downstream work that cannot be completed until it closes.
Dependency What it blocks
Selection and contracting of the third-party auto-dialer
vendor
Auto-dial and call-status display in the Agent workspace
(§6.3.2–6.3.3)
Selection and technical validation of ESSL device/API
integration
The entire ESSL attendance ingestion path (§7.6)
Selection of outbound messaging channel/provider Automatic product communication on Interested, and
notifications (§6.3.10, §9)
GROTEC sign-off on leave-type policy and payroll/statutory
calculation rules
Production leave configuration and payroll runs (§7.7,
§7.8)
Finalisation of the Founder vs. Manager/Admin restrictedcontrol boundary
Permission enforcement and audit-log access (§5.1.2,
§10)
GROTEC to provide initial crop/problem/solution content
and product-brand mapping
Knowledge Base content load (§6.5)
16. Open Items
Every decision deliberately left open by this PRD is consolidated here. No default has been assumed for any of
these. Each remains exactly as stated in the source material, and none may be resolved unilaterally during build.
Open item Where it
applies
The specific third-party auto-dialer vendor is not finalised. The integration approach is confirmed; the
vendor is not. GoDial is one candidate.
§6.3.2, §12
Channel, template, product mapping, message format and provider/API for automatic product
communication and notifications are implementation-design decisions, not fixed by this PRD.
§6.3.10, §9,
§12
Automatic retry behaviour for the "Not Answered" outcome is not finalised. Do not invent retry logic. §6.3.9
Whether Relationship Manager becomes a distinct permissioned login role is deferred to Phase 2
sales-workflow finalisation.
§6.4
The exact boundary of "Founder-restricted" controls vs. Manager/Admin is to be confirmed with
GROTEC during build.
§5.1.2
Exact Staff permission boundaries are to be finalised during detailed design and UAT. §5.1.4
Final ESSL integration method, API and provider must be technically validated before implementation. §7.6
Detailed dashboard metrics and widgets are to be finalised once the Agent workflow is fully built. §6.2
The final call-status list is provider-dependent. §6.3.3
Preconfigured leave types must be confirmed with GROTEC before being treated as final business §7.7
GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 19 of 25
Open item Where it
applies
policy.
Exact statutory/legal payroll rules (PF/ESI/PT/TDS treatment, working-day factor) must be validated
with GROTEC/finance before production.
§7.8.5
Additional reason capture for the "Not Interested" outcome is a candidate for detailed design, not yet
required.
§6.3.8
17. Acceptance Criteria (Phase 1, Representative)
Phase 1 is accepted when the following are demonstrated:
1. A telecaller can auto-dial a customer without manually entering the number, and call status is visible on
screen.
2. Full customer context — profile, history, notes — is visible during an active call.
3. A call not matching any existing customer record prompts creation of a new customer, with duplicatenumber detection in place.
4. Exactly three call outcomes are selectable, and Interested correctly branches to a mandatory single choice of
Callback or Sales.
5. Callback creates a follow-up with date, time and reason. Sales triggers Relationship Manager ownership
assignment and an automatic product-detail message.
6. Relationship Manager ownership prevents other telecallers from reassigning an owned customer without an
authorised workflow.
7. ESSL punches flow into HRMS attendance as a source, with HRMS remaining the system of record after
correction and approval.
8. Salary revisions are versioned and never overwrite prior revisions.
9. Monthly payroll follows Idle → Generated → Approved & Locked → Published, with approver and
timestamps captured.
10. Role-based access matches §5 for all four roles across CRM and HRMS.
11. CRM-generated performance metrics — calls dialed, calls connected, conversions — are visible on the
Employee Profile.
12. Employee and team KPI targets and weights are configurable (not hard-coded), and achievement tracks
against target without altering past-period scores.
13. A telecaller can search or browse the Knowledge Base by crop and/or problem and view the recommended
product/solution


# Appendix C — Project PRD reference (complete; Phase 2/3 sections are context only)


# GROTEC_FarmerOS_PRD_final (1).pdf

> Auto-extracted text from the PDF for reference and searching.

GROTEC FarmerOS
Phase 1 — Product Requirements Document
CRM · HRMS · ESSL Biometric Attendance
Version 2.0
Status Draft — for review
Date issued 26 August 2026
Prepared for GROTEC
Module scope CRM + HRMS + ESSL Biometric
Confidential — GROTEC internal and contracted delivery team only
Not baselined for build until approved (see Document Control).

-- 1 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 2 of 25
Contents
Document Control .......................................................................................................................................................................... 3
Source Documents...................................................................................................................................................................... 3
Approval ..................................................................................................................................................................................... 3
Revision History .......................................................................................................................................................................... 3
1. Executive Summary ..................................................................................................................................................................... 4
2. Business Problem ........................................................................................................................................................................ 4
3. Product Objectives (Phase 1) ...................................................................................................................................................... 5
4. Scope ........................................................................................................................................................................................... 5
4.1 In Scope for Phase 1 ............................................................................................................................................................. 5
4.2 Explicitly Out of Scope for Phase 1 ....................................................................................................................................... 5
4.3 Phase Roadmap (Planning Context) ..................................................................................................................................... 6
5. Users, Roles & Permissions ......................................................................................................................................................... 6
5.1 Role Model ........................................................................................................................................................................... 6
5.2 Permission Matrix (Indicative) .............................................................................................................................................. 7
6. CRM Module ............................................................................................................................................................................... 8
6.1 Navigation & Information Architecture ................................................................................................................................ 8
6.2 CRM — Telecaller Dashboard ............................................................................................................................................... 8
6.3 CRM — Agent Workflow....................................................................................................................................................... 8
6.4 CRM — Relationship Manager............................................................................................................................................ 10
6.5 CRM — Knowledge Base..................................................................................................................................................... 11
7. HRMS Module ........................................................................................................................................................................... 12
7.1 HRMS Dashboard ................................................................................................................................................................ 12
7.2 Employee Management ..................................................................................................................................................... 12
7.3 Employee Profile................................................................................................................................................................. 12
7.4 Employee Performance & KPI Integration (CRM ↔ HRMS) .............................................................................................. 12
7.5 Attendance ......................................................................................................................................................................... 13
7.6 ESSL Biometric Integration ................................................................................................................................................. 13
7.7 Leave Management ............................................................................................................................................................ 14
7.8 Payroll ................................................................................................................................................................................. 14
7.9 Employee History................................................................................................................................................................ 15
8. CRM ↔ HRMS Integration ....................................................................................................................................................... 15
9. Notifications .............................................................................................................................................................................. 15
10. Audit & Security ...................................................................................................................................................................... 16
11. Data Model — High-Level Entities (Phase 1)........................................................................................................................... 16
11.1 Data Model Invariants ...................................................................................................................................................... 16
12. API & Integration Requirements ............................................................................................................................................. 17
13. Non-Functional Requirements (Baseline) ............................................................................................................................... 17
14. Assumptions............................................................................................................................................................................ 17
15. Dependencies.......................................................................................................................................................................... 18
16. Open Items.............................................................................................................................................................................. 18
17. Acceptance Criteria (Phase 1, Representative) ....................................................................................................................... 19
18. Phase 2 Overview (Planning Context) ..................................................................................................................................... 19
18.1 Scope by Area ................................................................................................................................................................... 20
18.2 Dynamic Quantity Exception Handling ............................................................................................................................. 20
18.3 Operating Controls ........................................................................................................................................................... 21
18.4 Continuity with Phase 1 & Build Sequence ....................................................................................................................... 21
19. Phase 3 Overview (Planning Context) ..................................................................................................................................... 21
20. Future Enhancement Parking Lot ............................................................................................................................................ 22
Appendix A — Glossary ................................................................................................................................................................. 23
Appendix B — Consolidated State Machines ................................................................................................................................ 24
Appendix C — Items Requiring Confirmation ............................................................................................................................... 24

-- 2 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 3 of 25
Document Control
Field Value
Document title GROTEC FarmerOS — Phase 1 Product Requirements Document
Module scope CRM + HRMS + ESSL Biometric Attendance
Document type Phase 1 PRD (clean, implementation-ready)
Version 2.1
Status Draft — for review
Date issued 26 August 2026
Supersedes v2.0 (26 August 2026), v1.0 (23 August 2026)
Owner Product Owner, GROTEC FarmerOS
Audience GROTEC management, engineering, QA, implementation partner
Classification Confidential — GROTEC internal and contracted delivery team only
Source Documents
This PRD consolidates the following source material. Where this document and a source document disagree, this
document takes precedence for Phase 1 delivery. The source documents remain the reference for any detail not
yet finalised here.
• GROTEC FarmerOS Consolidated Phase Roadmap & Phase 1 Requirements (working document)
• GROTEC FarmerOS original requirement brief
• GROTEC HRMS feature documentation
• Factory-to-Customer Sales, Logistics & Transportation Automation System — Business Process Analysis &
System Requirements (Phase 2 planning input, summarised in §18)
Approval
This document is not baselined for build until it is signed off below.
Approved by Details
Name
Designation
Signature
Date
Revision History
Version Date Summary of change
1.0 23 Aug
2026
Initial consolidated Phase 1 PRD.
2.1 26 Aug
2026
Expanded §18 Phase 2 Overview to summarise the Factory-to-Customer Sales, Logistics
& Transportation Automation requirements. Planning context only — no change to

-- 3 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 4 of 25
Version Date Summary of change
Phase 1 scope.
2.0 26 Aug
2026
Restructured to standard PRD format. Rebuilt malformed tables, added per-module
acceptance criteria, consolidated state machines, expanded the data model, added
glossary and a list of items requiring confirmation. No business rule was added,
removed or changed; all items left open in v1.0 remain open and are consolidated in
§16.
1. Executive Summary
GROTEC FarmerOS is an integrated business platform for a farmer- and customer-facing agri business. It is
delivered in three progressive phases built on a single shared data foundation — one customer identity and one
employee identity, with no duplicate records across phases.
Phase Scope
Phase 1 (this
PRD)
CRM + HRMS + ESSL Biometric, including KPI configuration and tracking
Phase 2 Factory & Production + Inventory + Sales + Purchase + Dispatch/Transport + Delivery & POD +
Mobile-Optimised CRM
Phase 3 Accounts + PRI/Incentives + P&L/MIS + Founder Control Tower + WhatsApp Chatbot +
Automation
Phase 1 delivers the foundation layer: a Telecaller CRM for managing farmer/customer relationships and lead
conversion, and an HRMS for managing employees, attendance, leave and payroll, with ESSL biometric devices as
the attendance input source.
Four points define the character of Phase 1:
1. CRM and HRMS are one integrated platform, not two applications. They share a common employee identity
from day one.
2. The Agent calling workspace is the priority #1 build item. It is a full-screen calling workspace, not a lead
table.
3. KPI configuration and performance tracking are in Phase 1, not Phase 3, because they are tied directly to
CRM/telecaller activity captured from day one. Phase 3 later layers the monetary incentive engine on top
of this same data.
4. AI is not in Phase 1 build scope. AI-assisted features are included in Phase 3 (see §19).
2. Business Problem
CRM. Telecallers and agents currently lack a single workspace in which to call farmers/customers, see their
history, and act on the outcome of a call. The consequences are lost context between calls, duplicate customer
records, and untracked follow-ups.
HRMS. Separately, employee attendance, leave and payroll are not integrated with a single system of record, and
biometric attendance capture is not yet connected to HRMS processing.
Why together, and why now. Phase 1 addresses both problems in one release because they are not independent:
telecaller performance — calls made, connections, conversions — is itself an HRMS and performance input.

-- 4 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 5 of 25
Building CRM without the employee identity underneath it would force that identity to be rebuilt later, and would
delay performance measurement until after the data that measures it already exists.
3. Product Objectives (Phase 1)
1. Give telecallers a single full-screen workspace to dial, view customer context, and record call outcomes.
2. Ensure every phone number maps to one customer record — reduce duplicates.
3. Formalise the lead → interested → sales → relationship-ownership pipeline.
4. Provide a system of record for employees, attendance, leave and payroll.
5. Integrate ESSL biometric devices as an attendance input, while HRMS remains the attendance system of
record.
6. Share one employee identity across CRM and HRMS, so Phase 1 KPI tracking and future Phase 3 PRI/incentive
features do not require rebuilding identity data later.
7. Enforce the Phase 1 role model (Founder, Manager/Admin, Telecaller/Agent, Staff) across every module.
8. Give telecallers quick access to a crop/problem-based knowledge base, so they can recommend the right
product without needing deep agronomic expertise.
4. Scope
4.1 In Scope for Phase 1
Area In scope for Phase 1
CRM Dashboard; Agent (calling workspace); Relationship Manager (ownership concept); Knowledge Base
(crop/problem → solution search)
HRMS Employee management; employee profile; attendance; leave; payroll; payslips; reports; employee
history; CRM performance & KPI integration
Biometric ESSL device integration as attendance input source
Roles Founder, Manager/Admin, Telecaller/Agent, Staff
Integration Third-party auto-dialer (SIM-based, specific vendor TBD); ESSL device/API (provider TBD)
4.2 Explicitly Out of Scope for Phase 1
The following are not built in Phase 1. Any request to include one of them is a scope change requiring re-approval
of this document.
• Full sales transaction module
• Inventory management
• Purchase management
• Dispatch / transport module
• Full accounting
• Full P&L
• Founder Control Tower
• Advanced PRI / incentive payout engine — *note: KPI configuration and tracking itself is in Phase 1, see §7.4*
• WhatsApp chatbot

-- 5 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 6 of 25
• Full WhatsApp automation
• AI-assisted features — not in Phase 1; included in Phase 3 (§19)
• Additional organisational roles (Farmer Success Manager, Group Leader, FSE, Accounts/Finance, HR/Admin,
Purchase/Stores, Dispatch/Transport, Technical/Agronomy) as login roles — each is introduced when its
corresponding workflow ships
4.3 Phase Roadmap (Planning Context)
Phase Scope
Phase 1 (this PRD) CRM + HRMS + ESSL Biometric, incl. KPI configuration & tracking
Phase 2 Factory & Production + Inventory + Sales + Purchase + Dispatch/Transport + Delivery & POD +
Mobile-Optimised CRM
Phase 3 Accounts + PRI/Incentives + P&L/MIS + Founder Control Tower + WhatsApp Chatbot +
Automation
AI Not in Phase 1; AI-assisted features included in Phase 3
Note on KPI placement. KPI configuration and tracking is delivered in Phase 1 (§7.4) rather than Phase 3, because it
is tied directly to CRM/telecaller activity captured from day one. Phase 3 layers the PRI/incentive payout engine and
cross-business aggregation on top of this Phase 1 KPI data. Full Phase 2 and Phase 3 overviews are in §18 and §19.
5. Users, Roles & Permissions
5.1 Role Model
Phase 1 defines four login roles: Founder, Manager/Admin, Telecaller/Agent and Staff.
Additional organisational roles (Farmer Success Manager, Group Leader, FSE, Accounts, HR/Admin,
Purchase/Stores, Dispatch/Transport, Technical/Agronomy, and similar) will be introduced as login roles when
their corresponding workflow ships in a later phase. They are not modelled as login roles in Phase 1.
5.1.1 Founder
The highest-authority operational and administrative user.
• Full CRM access, full HRMS access, payroll access
• Reports, management dashboards, approvals
• System administration, sensitive administrative controls
• Audit and security-related controls, higher-level configuration
5.1.2 Manager / Admin
Almost the same operational access as the Founder. This is not a limited payroll user.
• CRM — farmer/customer records, agent/telecaller operations, relationship management
• HRMS — employee management, attendance, leave, payroll, salary information, payroll processing
• Reports, approvals, normal business configuration
Founder-only / restricted areas — the differentiator from Manager/Admin:
• Complete audit logs
• Sensitive security settings
• High-risk system administration

-- 6 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 7 of 25
• Ownership-level controls
• Critical, irreversible administrative actions
• Any other control explicitly reserved by the organisation
Open item. The exact boundary of "Founder-restricted" items must be confirmed with GROTEC during build. Treat
the list above as the working definition until confirmed.
5.1.3 Telecaller / Agent
Primarily a CRM user. No access to sensitive payroll or HR information.
• Telecaller Dashboard, Agent (calling workspace)
• Farmer/customer information, lead information
• Call records, follow-ups, notes, interest status
• Conversion workflow, assigned customer/lead data
• Knowledge Base search (crop/problem → recommended solution) — view and search only
5.1.4 Staff
HRMS/payroll and assigned office activities.
• Employee information, attendance, leave
• Salary inputs, salary structures, payroll preparation, payroll history, payslips
• Assigned administrative operations
Open item. Exact Staff permission boundaries are to be finalised during detailed design and UAT.
5.2 Permission Matrix (Indicative)
Capability Founder Manager/A
dmin
Telecaller/Agent Staff
CRM — Dashboard / Agent / Relationship
Manager
Yes Yes Yes (own
workload)
No
CRM — All customer records Yes Yes Assigned only No
CRM — Knowledge Base (search) Yes Yes Yes No
CRM — Knowledge Base (content management) Yes Yes No No
HRMS — Employee management Yes Yes No Assigned
scope
HRMS — Attendance / Leave Yes Yes Own attendance
only
Yes
HRMS — Payroll processing Yes Yes No Yes
(preparation)
HRMS — KPI configuration Yes Partial No No
Audit logs / security settings Yes No No No
System administration Yes No No No
This matrix is indicative and is subject to the two open items above.

-- 7 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 8 of 25
6. CRM Module
6.1 Navigation & Information Architecture
The Telecaller CRM presents exactly four top-level navigation items, in this order:
Telecaller
├── Dashboard
├── Agent
├── Relationship Manager
└── Knowledge Base
6.2 CRM — Telecaller Dashboard
Purpose. The telecaller's daily work overview. It answers one question: "Who do I need to contact today, and
what is pending for each customer?"
The dashboard must show:
• Today's assigned calls
• Pending follow-ups, with overdue follow-ups clearly distinguished
• New leads
• Interested customers
• Converted customers
• Completed calls
• Follow-up reminders
• Recent CRM activity
Dashboard content for a Telecaller/Agent is scoped to that user's own workload.
Sequencing note. Detailed dashboard metrics and widget definitions are to be finalised once the Agent workflow
(§6.3) is fully built, since the dashboard surfaces Agent-generated data. Build the Agent workspace first.
6.3 CRM — Agent Workflow
This is the priority #1 build item for Phase 1.
6.3.1 Core Concept
The Agent screen is a full-screen calling workspace, not a lead table. The telecaller performs the entire calling
workflow from one screen, without navigating away:
Dial → View customer context → Record outcome → Next action
6.3.2 Auto-Dial / Telephony Integration
Decision (confirmed). A third-party auto-dialer will be used for SIM-based auto-dial and call-status
synchronisation, rather than building native telephony in-house. GoDial was raised as an example candidate; the
specific vendor is still to be finalised, but the integration approach is confirmed: third-party auto-dialer
integration, not a custom-built dialer.
• The telecaller must not have to manually type the customer's number.
• The CRM must provide an auto-dial action that places the call through the telecaller's own mobile/SIM.
• Auto-dial must be implemented as an integration with a third-party auto-dialer. Building a native or custom
dialer is out of scope.

-- 8 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 9 of 25
• The integration must support SIM-based auto-dial and call-status synchronisation back into the CRM.
• The integration must sit behind an internal abstraction, so that vendor selection does not force a rewrite of
the Agent workspace.
6.3.3 Call Status
The CRM must receive or derive call state from the dialer integration and display it to the telecaller during the
call. Candidate states — the final list is provider-dependent:
Dialing ──→ Ringing ──→ Connected ──→ Ended
│
└──────→ Not Answered
Open item. The final call-state list is provider-dependent and cannot be fixed until the dialer vendor is selected.
Model call state as configurable rather than hard-coded.
6.3.4 Customer Context During the Call
While a call is active, all available customer context must be visible on the same screen as the call controls:
• Name, mobile number, alternate mobile
• Location — village, taluk / district / state
• Crop information and acreage
• Previous interactions, call history and notes
• Lead/source information, interest history and follow-up history
• Existing customer/order-relevant information, once such information is available to the platform
6.3.5 Customer Resolution & Duplicate Prevention
On dialling or receiving a number, the system resolves that phone number to an existing customer record. The
system must actively reduce duplicate records, particularly when a mobile number already exists.
Phone Number
│
├──→ Existing customer found ──→ Show existing profile
│
└──→ Not found / incomplete ──→ Create / complete customer ──→ Continue call
Creating or completing a customer record must not end or interrupt the call.
6.3.6 Call Outcome
The system offers exactly three call outcomes, prominent and fast to select:
1. Interested
2. Not Interested
3. Not Answered
Call Outcome and Next Action are separate data concepts and must never be merged into a single status field.
6.3.7 Interested → Next Action
Selecting Interested is a two-stage decision, and the two stages are stored separately. Selecting Interested opens
a modal requiring exactly one of Callback or Sales. The selection is mandatory — the outcome cannot be saved as
Interested without one.
Interested
│

-- 9 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 10 of 25
├──→ Callback ──→ follow-up date + time + reason ──→ Follow-up record created
│
└──→ Sales ──→ CRM progression + RM ownership + automatic product communication
Interested → Callback collects only the follow-up date, the follow-up time, and the follow-up reason/note. The
system then creates the follow-up record.
Interested → Sales does four things:
1. Marks the appropriate CRM progression.
2. Moves the customer toward sales handling.
3. Starts/triggers Relationship Manager ownership per the business rule in §6.4.
4. Automatically sends relevant product details to the farmer/customer (§6.3.10).
The full sales transaction workflow itself is Phase 2 scope. Phase 1 marks the progression and hands over
ownership; it does not process the sale.
6.3.8 Not Interested
• Store the outcome as Not Interested, record it in call history, and retain customer history.
• No Callback/Sales popup is shown for this outcome.
• Additional reason capture is a candidate for detailed design and is not yet required.
6.3.9 Not Answered
• Record the call outcome and the attempt/history.
• Allow a future follow-up, per the final business rule.
Open item. Automatic retry behaviour for Not Answered is not finalised. Do not invent retry logic. This is an open
business decision and must be closed by GROTEC before any retry behaviour is implemented.
6.3.10 Automatic Product Communication
On an Interested outcome, the system automatically sends relevant product details to the customer. Phase 1
requires a working automatic-send mechanism (e.g. SMS, WhatsApp Business API or email); full WhatsApp
automation capability is Phase 3 scope. The message content may be informed by the Knowledge Base (§6.5)
when the customer's crop/problem is already known from the call.
Open item. Channel, template, product mapping, message format and provider/API are implementation-design
decisions and are not fixed by this PRD.
6.4 CRM — Relationship Manager
Relationship Manager (RM) is a functional CRM ownership concept, not automatically a separate login role (see
§5.1).
Agent
→ Customer becomes Interested
→ Sales / Conversion
→ Relationship Manager ownership
→ Assigned RM manages the customer
Ownership rule. Once a customer is assigned or converted to an RM, that customer is managed by the assigned
RM. There must be no free reassignment across telecallers unless an authorised workflow permits it.
RM responsibilities in Phase 1:
• My Customers, customer follow-ups, customer information
• Customer interaction/relationship history, notes

-- 10 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 11 of 25
• (Future) sales/order history, once Phase 2 is integrated — not Phase 1 scope
Lead ownership and relationship ownership must remain distinct in the data model:
AGENT: Prospect → Contact → Interested → Sales/Conversion
RELATIONSHIP MANAGER: Customer Ownership → Ongoing Relationship → Repeat Business
This distinction matters for CRM reporting, ownership, performance measurement and customer continuity.
Collapsing the two into one ownership field would make it impossible to attribute conversion performance to the
agent while attributing retention to the RM.
Open item. Whether RM becomes a distinct permissioned role is a decision deferred to Phase 2 sales-workflow
finalisation.
6.5 CRM — Knowledge Base
Purpose. Give telecallers instant access to a searchable crop/problem → product-solution reference, so they can
recommend the right GROTEC product during a call without needing deep agronomic expertise.
6.5.1 Core Concept
The telecaller searches or browses by crop (crops, trees or other agro produce GROTEC deals in), selects the
relevant problem/issue affecting that crop (pest, disease, nutrient deficiency, weed, etc.), and is shown the
recommended product/brand solution — similar to looking up an item in a product catalogue.
Select / Search Crop
│
└──→ Select Problem / Issue affecting that crop
│
└──→ View recommended Product / Brand Solution
│
└──→ (optional) Reference during an active call
6.5.2 Content Structure
Entity Attributes
Crop Name, category (e.g. field crop, tree crop, plantation crop)
Problem / Issue Type (pest, disease, nutrient deficiency, weed, other), symptoms/keywords, linked
crop(s)
Solution / Product
Reference
Recommended product name, brand, linked problem(s), high-level usage guidance
6.5.3 Search & Filters
• Search/filter by crop name
• Search/filter by problem/symptom keyword
• Combined crop + problem search
• Fast, typeahead-style search suitable for use mid-call
6.5.4 Content Management & Access
• Founder and Manager/Admin can create, edit and retire Crop, Problem and Solution entries.
• Telecaller/Agent has search and view-only access; no content management.
• Content changes must be tracked (who and when), consistent with the audit principle in §10.

-- 11 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 12 of 25
• The Knowledge Base must be accessible from within the Agent calling workspace (§6.3), so a telecaller can
look something up without leaving the call context.
6.5.5 Boundaries
• This is a content reference structure, not the full product/inventory master — that is built in Phase 2
Sales/Inventory (§18). Once Phase 2 ships, Knowledge Base solution references can link to the live product
master instead of a static entry.
• Actual agronomic content — which product treats which problem — is provided and owned by GROTEC.
The platform provides the structure and the search. It is not an agronomic authority over the content.
7. HRMS Module
Coverage. Dashboard, Employee Management, Employee Profile, Attendance, Leave Management, Payroll (salary
revisions, salary structure, advances/recoveries, monthly payroll, payslips, reports), Employee History, and CRM
performance & KPI integration.
7.1 HRMS Dashboard
A real-time organisation snapshot showing Total Employees, Present Today, Pending Leave Requests, Pending
Payroll Approvals, Today's Attendance and Pending Approvals, with quick links to Mark Attendance, Apply Leave
and Run Payroll.
7.2 Employee Management
Employee List — search, sort and filter by department, status and designation. Columns: Employee ID, Name,
Department, Designation, Joining Date, Experience, Status, Actions.
Add / Edit Employee is organised in four sections:
1. Personal Information — Name, Phone, Email, Address
2. Employment Details — Employee ID, Designation, Department, Reporting Manager, Joining Date, Experience,
Status
3. Documents
4. Notes / Remarks
7.3 Employee Profile
The employee profile presents seven areas: Overview, Performance, Attendance, Leave, Salary & Payslips,
Advances, Training & History.
Overview shows contact details, employment details, current salary snapshot, Employee ID, joining date,
department, designation, status and experience, with quick actions for Edit Profile, Mark Attendance, Apply Leave
and View Payslips.
7.4 Employee Performance & KPI Integration (CRM ↔ HRMS)
This section is the bridge between the two modules, and is the reason KPI tracking sits in Phase 1.
7.4.1 CRM-Linked Metrics on the Employee Profile
Required: Calls Dialed, Calls Connected, Leads Converted, Conversion Rate, Total Revenue.
Optional: 3-month and 6-month trend views; connected-vs-dialed breakdown; call-outcome breakdown; rating,
department rank, call quality, responsiveness, attendance, monthly breakdown.

-- 12 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 13 of 25
Requires confirmation. Total Revenue is listed as a Phase 1 metric, while the sales transaction module that would
generate revenue is Phase 2 scope (§4.2). The source of the Phase 1 revenue figure needs confirmation. It has been
left exactly as stated rather than changed.
7.4.2 KPI Configuration & Tracking (Phase 1 Scope)
• Employee and team targets must be configurable by employee, role, period or team — never hard-coded.
• KPI weights across metrics (e.g. calls, conversion, CRM discipline/compliance, customer quality, attendance)
must be configurable and adjustable for future periods.
• Achievement tracking must record actual value vs. target and achievement percentage.
• The system must produce an overall configurable performance score/status per employee per period.
• The system must capture monthly review notes and coaching actions.
• Historical KPI scores must remain unchanged if KPI settings are modified in a later period — the same
historical-preservation principle used for salary revisions (§7.8.1).
• KPI and target configuration changes must be auditable (§10).
7.4.3 Forward Compatibility
Additional metrics such as collection performance and repeat business will layer onto this KPI framework once
Phase 2 Sales data is available. This KPI foundation feeds directly into the Phase 3 PRI/incentive engine and
Founder Control Tower rollups (§19): Phase 1 delivers configuration and tracking, Phase 3 adds the monetary
incentive calculation and cross-business aggregation.
7.5 Attendance
• Attendance calendar, mark entry, bulk attendance, correction and history.
• Status values: Present, Absent, Late, HalfDay, WeeklyOff, Holiday, Leave.
• Attendance approval must retain approval history, not just current status (§10).
Mark Entry → Pending → Approval → Approved
│
└────→ Rejected + reason
7.6 ESSL Biometric Integration
Explicitly in Phase 1. Purpose: eliminate manual daily attendance entry.
ESSL Biometric Device
↓
ESSL Integration / API / Connector
↓
GROTEC Attendance Processing
↓
Attendance Records
↓
Correction / Approval
↓
Payroll
7.6.1 Architecture Rule (Non-Negotiable)
ESSL is an attendance input/source only. GROTEC HRMS remains the system of record for processed attendance,
corrections, approval status, leave linkage, payroll calculations and attendance history.
7.6.2 Integration Capability Required
• Employee-to-device mapping

-- 13 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 14 of 25
• Punch-in and punch-out events with date/time and device/source
• Multiple punches per employee per day
• Attendance synchronisation from device to HRMS
7.6.3 Exception Handling Required
• Missing punch
• Incorrect punch
• Duplicate or invalid punch
• Device or network sync failure
Attendance records must retain their source (ESSL or manual), so a processed record can always be traced back to
its origin. ESSL-sourced attendance still passes through the correction and approval flow in §7.5 before reaching
payroll.
Open item. The final ESSL integration method, API and provider must be technically validated before
implementation. Treat this as an open dependency (§15).
7.7 Leave Management
• Leave types, leave quotas, carry-forward, and paid/unpaid classification
• Leave balance, leave application, approval/rejection and leave history
• Department filtering and export/reporting
• Leave approval must retain approval history, not just current status (§10)
Open item. Preconfigured leave types exist in the HRMS source documentation, but must be confirmed with
GROTEC before being treated as final business policy. Do not hard-code them as final without sign-off.
7.8 Payroll
7.8.1 Salary Revisions
Salary history is versioned, with effective dates and saved-by information. A new salary structure must never
overwrite previous revisions — salary revision storage is append-only.
7.8.2 Salary Structure
Earnings, deductions, amount, taxable flag and custom components, with computed gross, total deductions and
net payable.
7.8.3 Advances & Recoveries
An advance ledger with recovery entries, running balance, linked month and notes.
7.8.4 Monthly Payroll Workflow
Idle → Generate → Generated → Approve & Lock → Approved → Publish → Published
A payroll record captures: Employee, Gross, Deductions, Attendance adjustment, Net pay, Flags/errors, Approver,
Approval timestamp, Publication timestamp. Approval locks the payroll run, and both approval and publication
are auditable (§10).
7.8.5 Payroll Calculation
The calculation concept, per the existing HRMS specification:
1. Active / Probation employees

-- 14 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 15 of 25
2. Latest effective salary revision
3. Gross earnings, total deductions
4. Approved absent days, approved half days
5. Working-day salary calculation
6. Attendance adjustment
7. Advance recovery
8. Net pay
9. Validation flags
Open item. The exact statutory/legal payroll rules — PF / ESI / PT / TDS treatment, working-day factor, and similar
— must be validated with GROTEC/finance before production. The current specification uses a standard working-
day factor and configurable components; this is not yet confirmed as final legal/payroll policy.
7.8.6 Payslips & Reports
Payslips — published payroll months, employee search/filter, payslip list, month selection, net pay display, PDF
download.
Payroll reports — monthly payroll cost, department-wise payroll cost, payroll totals, all exportable.
7.9 Employee History
Training, Warning, Commendation and Promotion records, each capturing Type, Date, Description and Added by.
The structure supports future performance and HR reporting.
8. CRM ↔ HRMS Integration
A common employee identity is shared across both modules — there are no duplicate employee records. A
telecaller is an employee record, not a separate CRM user record.
Employee → Telecaller/Agent → CRM Activity
↓
Calls / Connections / Leads / Conversions / Revenue
↓
HRMS Performance & KPI
CRM activity flows to the HRMS performance and KPI layer without manual re-entry. This enables Phase 1 KPI
tracking today, and future Phase 3 PRI/incentive and Founder Control Tower calculations, without rebuilding
employee identity later.
9. Notifications
• Follow-up reminders, generated from Callback scheduling (§6.3.7)
• Automatic product-detail message on an Interested outcome (§6.3.10)
• Attendance and leave approval notifications — approved / rejected
• Payroll status notifications — generated / approved / published — as applicable to Manager/Admin/Staff
Open item. The exact channel and provider for each notification type is an implementation-design decision (see
§6.3.10).

-- 15 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 16 of 25
10. Audit & Security
• Founder-restricted: complete audit logs, sensitive security settings, high-risk system administration,
ownership-level controls, irreversible administrative actions.
• Critical actions must be traceable — who, when, what changed.
• Role-based access must be enforced on every module per §5.
• Approval workflows (attendance, leave, payroll) must retain approval history, not just current status.
Actions requiring an audit trail: payroll approval and publication; attendance approval; employee status changes;
customer reassignment; KPI and target configuration changes; Knowledge Base content changes.
11. Data Model — High-Level Entities (Phase 1)
Entity Key attributes and relationships
Customer / Farmer Identity, contact, location (village / taluk / district / state), crop, acreage, source/lead
info
Lead / Call Linked to Customer; outcome; next action; follow-up
Follow-up Date, time, reason; linked to Lead/Call and to Agent
Relationship Ownership Customer → assigned Relationship Manager
Crop Name, category
Problem / Issue Type, symptoms/keywords, linked crop(s)
Solution / Product
Reference
Linked problem(s), recommended product/brand, usage guidance
Employee Identity, employment details, documents, reporting manager
Attendance Record Employee, date, status, source (ESSL / manual), approval state
Leave Application Employee, type, dates, status, approval history
Salary Revision Employee, effective date, components, saved-by — append-only, versioned
KPI Target Employee/team, period, metric, target value, weight — versioned, immutable per
period once set
Payroll Run Month, employee, gross, deductions, net, status, approver, timestamps
Advance / Recovery Employee, amount, linked month, running balance
Employee History Record Employee, type, date, description, added-by
11.1 Data Model Invariants
These constraints follow from requirements elsewhere in this document and must be enforced at the data layer,
not only in application code:
• Call Outcome and Next Action are stored as separate fields; they must never be collapsed into one status
column.
• Lead ownership (Agent) and relationship ownership (RM) are separate relationships on the Customer entity.
• One employee identity is shared by CRM and HRMS; there is no separate CRM user entity.
• Salary Revision is append-only.
• KPI Target is immutable for a period once that period's scores are computed.

-- 16 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 17 of 25
• Attendance Record always retains its source.
12. API & Integration Requirements
Integration Status Requirement
Auto-Dialer Approach confirmed;
vendor TBD
SIM-based auto-dial and call-status sync via a third-party auto-dialer
integration. Specific vendor TBD — GoDial is one candidate.
ESSL
Biometric
Provider and method
TBD
Device/API connector for punch-data ingestion. Final provider/method TBD;
technical validation required before implementation.
Outbound
messaging
Channel/provider
TBD
Required for the automatic product-detail send on an Interested outcome.
Channel/provider TBD — SMS, WhatsApp Business API or email — an
implementation-design decision.
Two rules apply across all three: each external integration must sit behind an internal abstraction, so a change of
vendor does not require changes to CRM or HRMS business logic; and integration failures must be surfaced and
recoverable, not silent.
13. Non-Functional Requirements (Baseline)
• Access control — role-based access control enforced at both API and UI level.
• Historical preservation — historical data (salary revisions, KPI targets and scores, attendance, call history)
must be preserved, not overwritten.
• Single source of truth — one authoritative record for Customer, Employee, Attendance and Payroll data.
• Configurability — salary components, leave types, CRM statuses, KPI targets and weights must avoid
unnecessary hard-coding.
• Auditability — critical actions are auditable per §10.
• Search responsiveness — Knowledge Base search must be fast enough for typeahead use during a live call.
Note. This is a baseline set. Measurable service-level targets — page-load time, dial latency, concurrent-user load,
uptime, data-retention periods — are not specified in the source material and are not invented here. They should
be agreed and appended before the build is contracted against them.
14. Assumptions
• Auto-dial will use a third-party auto-dialer (confirmed approach). The specific vendor and the final ESSL
provider/API will be selected during technical/integration planning, and are not fixed by this PRD.
• Statutory payroll rules (PF / ESI / PT / TDS, working-day factor) require confirmation with GROTEC/finance
before production payroll runs.
• Preconfigured leave types from the existing HRMS documentation are draft values, pending GROTEC business-
policy confirmation.
• Relationship Manager may or may not become a distinct permissioned role — the decision is deferred to
Phase 2 planning.
• "Not Answered" automatic retry behaviour is an open business-rule decision, not yet finalised.

-- 17 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 18 of 25
• Knowledge Base crop/problem/solution content — which product treats which problem — will be provided
and maintained by GROTEC. The platform provides the search and structure, not agronomic authority over
the content.
15. Dependencies
Phase 1 delivery depends on the following being resolved by GROTEC or by joint technical planning. Each has
downstream work that cannot be completed until it closes.
Dependency What it blocks
Selection and contracting of the third-party auto-dialer
vendor
Auto-dial and call-status display in the Agent workspace
(§6.3.2–6.3.3)
Selection and technical validation of ESSL device/API
integration
The entire ESSL attendance ingestion path (§7.6)
Selection of outbound messaging channel/provider Automatic product communication on Interested, and
notifications (§6.3.10, §9)
GROTEC sign-off on leave-type policy and payroll/statutory
calculation rules
Production leave configuration and payroll runs (§7.7,
§7.8)
Finalisation of the Founder vs. Manager/Admin restricted-
control boundary
Permission enforcement and audit-log access (§5.1.2,
§10)
GROTEC to provide initial crop/problem/solution content
and product-brand mapping
Knowledge Base content load (§6.5)
16. Open Items
Every decision deliberately left open by this PRD is consolidated here. No default has been assumed for any of
these. Each remains exactly as stated in the source material, and none may be resolved unilaterally during build.
Open item Where it
applies
The specific third-party auto-dialer vendor is not finalised. The integration approach is confirmed; the
vendor is not. GoDial is one candidate.
§6.3.2, §12
Channel, template, product mapping, message format and provider/API for automatic product
communication and notifications are implementation-design decisions, not fixed by this PRD.
§6.3.10, §9,
§12
Automatic retry behaviour for the "Not Answered" outcome is not finalised. Do not invent retry logic. §6.3.9
Whether Relationship Manager becomes a distinct permissioned login role is deferred to Phase 2
sales-workflow finalisation.
§6.4
The exact boundary of "Founder-restricted" controls vs. Manager/Admin is to be confirmed with
GROTEC during build.
§5.1.2
Exact Staff permission boundaries are to be finalised during detailed design and UAT. §5.1.4
Final ESSL integration method, API and provider must be technically validated before implementation. §7.6
Detailed dashboard metrics and widgets are to be finalised once the Agent workflow is fully built. §6.2
The final call-status list is provider-dependent. §6.3.3
Preconfigured leave types must be confirmed with GROTEC before being treated as final business §7.7

-- 18 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 19 of 25
Open item Where it
applies
policy.
Exact statutory/legal payroll rules (PF/ESI/PT/TDS treatment, working-day factor) must be validated
with GROTEC/finance before production.
§7.8.5
Additional reason capture for the "Not Interested" outcome is a candidate for detailed design, not yet
required.
§6.3.8
17. Acceptance Criteria (Phase 1, Representative)
Phase 1 is accepted when the following are demonstrated:
1. A telecaller can auto-dial a customer without manually entering the number, and call status is visible on
screen.
2. Full customer context — profile, history, notes — is visible during an active call.
3. A call not matching any existing customer record prompts creation of a new customer, with duplicate-
number detection in place.
4. Exactly three call outcomes are selectable, and Interested correctly branches to a mandatory single choice of
Callback or Sales.
5. Callback creates a follow-up with date, time and reason. Sales triggers Relationship Manager ownership
assignment and an automatic product-detail message.
6. Relationship Manager ownership prevents other telecallers from reassigning an owned customer without an
authorised workflow.
7. ESSL punches flow into HRMS attendance as a source, with HRMS remaining the system of record after
correction and approval.
8. Salary revisions are versioned and never overwrite prior revisions.
9. Monthly payroll follows Idle → Generated → Approved & Locked → Published, with approver and
timestamps captured.
10. Role-based access matches §5 for all four roles across CRM and HRMS.
11. CRM-generated performance metrics — calls dialed, calls connected, conversions — are visible on the
Employee Profile.
12. Employee and team KPI targets and weights are configurable (not hard-coded), and achievement tracks
against target without altering past-period scores.
13. A telecaller can search or browse the Knowledge Base by crop and/or problem and view the recommended
product/solution.
18. Phase 2 Overview (Planning Context)
Theme: turn the Phase 1 CRM relationship into a connected factory-to-customer operation — production,
inventory, sales, dispatch, transport, field delivery, exception handling and post-delivery follow-up in one
workflow. The governing principle: physical stock, digital inventory, orders, invoices, dispatch records, vehicle
stock and delivery outcomes stay synchronised across the lifecycle, rather than each department keeping its
own records.

-- 19 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 20 of 25
Production → Inventory → Order → Stock Allocation → Dispatch (Trip) ID → Loading + Manifest
→ Invoice → Route → Live Tracking → Delivery → Dynamic Quantity Handling → POD
→ Remaining Vehicle Stock → Reallocation → Customer Care → Field Lead into CRM
→ Reconciliation → Trip Closure → Manager & Founder Oversight
18.1 Scope by Area
Area Phase 2 scope
Factory &
Production
Daily/monthly production, finished-goods register, products sent out, dispatch preparation,
loading verification
Inventory SKU master, batch, valuation, movement history, low-stock alerts. Stock holds state, not one
number — produced, available, allocated, loaded, delivered, remaining in vehicle, returned,
reallocated — and is never counted as available in two places at once
Sales & Orders Product master, quotation, order, pricing, taxes, discounts, invoice, collection/outstanding,
order history. Orders carry original, approved and delivered quantity plus exception history
Purchase Supplier master, PO, GRN, purchase invoice, supplier outstanding — financial treatment
completes in Phase 3
Dispatch &
Manifest
System-generated trip ID linking vehicle, crew, orders, invoices, manifest, route, GPS,
kilometres and closure. Loading reconciles planned vs. physically loaded vs. digitally confirmed;
a mismatch blocks dispatch
Route & Transport Optimised multi-stop routing, stop sequence, distance, milestones — planned stored
separately from actual
Live Tracking Vehicle GPS bound to the active trip: location, movement history, stops, kilometres, shown as a
trip timeline
Delivery Mobile
App
Field app for delivery staff — dispatch, manifest, route, delivery, exceptions, lead capture, trip
summary. Works offline, syncs with conflict validation
Proof of Delivery Photograph and/or digital sign-off against dispatch, customer, order, invoice, quantity, time,
location and staff
Vehicle Stock &
Reallocation
Stock on the lorry tracked as its own position; excess from short deliveries goes to nearby
existing customers or becomes a lead. Every reallocation is auditable
Stock Shortage Configurable customer priority decides allocation, resolved as reduced quantity or postponed
delivery — never an undocumented edit
CRM — Field Leads Delivery staff search the existing customer base; with no match they raise a lead into the Phase
1 CRM for call-executive follow-up and conversion tracking
Customer Care Post-delivery reviews, remarks and feedback linked to customer, order, delivery, dispatch and
staff
Management
Visibility
Layered dashboards — executive, production, inventory, dispatch, live transit, delivery,
sales/CRM — plus an Exception Centre for pending approvals, shortages, priority conflicts,
excess stock, postponed deliveries, missing PODs and unclosed trips
Mobile-Optimised
CRM
Not a second CRM — a mobile-first adaptation of the Phase 1 CRM: same backend, APIs,
customer identity, ownership rules and history. No duplicate customer database
18.2 Dynamic Quantity Exception Handling
The core operational problem of Phase 2, and a first-class workflow rather than an edit field: the ordered
quantity is not necessarily the delivered quantity, and delivery staff must never change it silently.

-- 20 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 21 of 25
Customer requests change → Staff raises request → System validates stock & rules → Manager decides
→ Approved quantity becomes operational → Invoice revised
→ Inventory, vehicle stock, sales, delivery app and dashboards all updated
A decrease (order 100, accepted 80) returns the undelivered 20 to the vehicle's stock pool; an increase (order
100, wanted 120) is checked against vehicle, reallocatable and factory stock before authorisation. Requests carry
dispatch, customer, order, invoice, original and requested quantity, reason, raiser, time, location and optional
photo evidence, and are stored as adjustments rather than overwrites. The outcome to prevent is the delivery
app showing 80 while invoice, inventory and sales still show 100.
18.3 Operating Controls
• Lifecycle states. Dispatch runs Draft → Planned → Loading → Loaded → Dispatched → In Transit → Delivering
→ Reconciliation → Closed; delivery runs Planned → En Route → Arrived → In Progress → Completed, with
partial, postponed and failed exception states; quantity exceptions run Requested → Under Review →
Approved/Rejected/Revised → Applied.
• Trip closure requires reconciliation. All stops resolved, quantities confirmed, exceptions closed, PODs present
or logged, kilometres finalised, and vehicle stock balanced with no unexplained balance. Closing stock is
classified as returned, transferred or pending.
• Business rules stay configurable, not hard-coded: no silent quantity change; invoice matches approved
quantity; vehicle stock reflects physical reality; reallocation is always recorded; shortages need documented
allocation; closure needs reconciliation; every field lead keeps its staff and dispatch reference; management
views lead with exceptions and KPIs, not raw event streams.
• Auditability. Every significant change emits an event carrying user, time, entity, dispatch reference and
before/after state. Concurrent allocations against the same stock must not both succeed.
• New login roles arrive with their workflow, as Phase 1 anticipates (§5.1): Factory In-Charge, Driver, Delivery
Staff, Relation/Call Executive, Sales, Manager and Founder.
18.4 Continuity with Phase 1 & Build Sequence
Phase 2 extends the Phase 1 foundation rather than duplicating it: one customer identity (field leads search the
Phase 1 base first, and the duplicate rule in §6.3.5 still applies), one employee identity (delivery, driver and
factory users are HRMS records, §8), one KPI framework (delivery-staff deliveries, leads and conversions layer
onto the configurable Phase 1 model, §7.4), and one relationship model (converted field leads enter the
Relationship Manager ownership flow, §6.4).
A sensible build order is: A operational foundation (roles, customers, products, production, inventory, orders, trip
ID, manifest, loading, basic delivery) → B logistics intelligence (routing, GPS, kilometres, mobile app, POD) → C
exception automation (quantity changes, approvals, dynamic invoicing, vehicle stock, reallocation, shortages) → D
sales/CRM expansion (field leads, conversion tracking, delivery-staff performance) → E executive intelligence
(dashboards, KPI reporting, exception centre, analytics).
Accounts is intentionally not in Phase 2 — it is deferred to Phase 3.
19. Phase 3 Overview (Planning Context)
Theme: finance, incentive administration, management visibility, workflow-based communication, and AI-assisted
intelligence.
Area Scope

-- 21 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 22 of 25
Area Scope
Accounts Customer/supplier ledgers, receivables/payables, receipts/payments, expenses, cash/bank,
transaction categorisation — built on top of Phase 2 transaction data
PRI / Incentives Incentive rules, slabs (fixed/percentage/hybrid), eligibility rules, disqualifiers, explainable
monthly calculations, subject to management approval — calculated using the KPI achievement
data captured in Phase 1 (§7.4), plus collection and repeat-business inputs once Phase 2 Sales
data is available
P&L / MIS Revenue, COGS, gross/management profit, receivables/payables, product profitability,
monthly/quarterly/yearly comparison, drill-down to transaction level, period closing/locking so
approved historical reports cannot be silently changed
Founder Control
Tower
A single management view across Sales, Collections, Operations, People, CRM, Finance and
Exceptions
WhatsApp Chatbot
& Automation
Initially workflow/rule-based — customer identification, product enquiry, lead creation, follow-
up/callback requests, order/dispatch status, RM connect — plus automated notifications
(order/payment/dispatch confirmations, reminders, consent/opt-out handling)
Legacy Data
Migration
Study existing software exports/Excel databases; field mapping and data-cleaning rules;
duplicate detection and merge rules; pilot migration and validation; full migration with
reconciliation (source / imported / rejected / duplicate counts); preserved recoverable source
copies and migration logs
Security,
Ownership & IP
Governance
Source code repository and cloud/domain/database/production credentials under GROTEC-
controlled ownership; individual, role-based, revocable developer/staff access; controlled and
logged data exports; version-controlled production changes; documentation and handover
sufficient for a future maintenance team; GROTEC data and deliverables not reused or disclosed
without authorisation
AI Assistance &
Management
Intelligence
Advisory AI layered on the Phase 1–3 data foundation: call/note summarisation; next-action
suggestions (follow-up / quotation / escalation); natural-language smart search across
authorised farmer/business data; FSE call-prep assistance and approved message drafting;
performance-gap analysis from activity/pipeline/conversion/collection/attendance data;
management-analyst Q&A on profit/sales/conversion changes; exception alerts on unusual
overdue/stock/collection/performance patterns
AI status. AI is not included in Phase 1. AI-assisted features are included in Phase 3, scoped as advisory intelligence
layered on the CRM/HRMS/Sales/Accounts data built in Phases 1–2. AI outputs remain advisory only — final
appraisal, salary, incentive, financial-approval and agronomic decisions stay with authorised humans.
20. Future Enhancement Parking Lot
Items recorded so they are not lost, and explicitly not committed to Phase 1:
• Full Phase 2 and Phase 3 scope (§18–§19)
• Relationship Manager as a distinct permissioned role
• Advanced call-outcome reason capture for Not Interested
• Automatic retry rules for Not Answered
• Knowledge Base feedback loop — telecallers flagging missing or unclear crop/problem/solution entries

-- 22 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 23 of 25
Appendix A — Glossary
Term Definition
Agent The full-screen CRM calling workspace (§6.3); also the Telecaller/Agent login role.
Auto-dialer Third-party service that places calls through the telecaller's own mobile/SIM and synchronises
call status back to the CRM.
Call Outcome One of exactly three values recorded at the end of a call: Interested, Not Interested, Not
Answered. Distinct from Next Action.
ESSL The biometric attendance device family used as the attendance input source. An input only —
never the system of record.
Dispatch / Trip ID Temporary system-generated identifier representing one vehicle dispatch/trip lifecycle (Phase
2, §18).
Excess Stock Product left in the vehicle because a customer accepted less than planned (Phase 2).
FSE Field Sales Executive — an organisational role, not a Phase 1 login role.
GRN Goods Receipt Note (Phase 2 Purchase).
KPI Key Performance Indicator — configurable target, weight and achievement per employee per
period (§7.4).
Knowledge Base Crop → problem → recommended product/brand reference used by telecallers mid-call
(§6.5).
Lead ownership The Agent's ownership of a prospect through to conversion. Distinct from relationship
ownership.
LR Lorry Receipt / transport consignment reference (Phase 2 Dispatch).
Manifest Digital list of products, quantities, customers/orders and delivery information for a dispatch
(Phase 2).
MIS Management Information System reporting (Phase 3).
Next Action The follow-on decision after an Interested outcome: Callback or Sales. Stored separately from
Call Outcome.
P&L Profit and Loss statement (Phase 3).
POD Proof of Delivery — photograph and/or digital sign-off (Phase 2).
Quantity Exception A request to change the planned/approved delivery quantity (Phase 2, §18.2).
Reallocation Movement of available stock from one customer allocation to another (Phase 2).
PRI Performance-Related Incentive — the Phase 3 incentive engine built on Phase 1 KPI data.
Relationship
ownership
The RM's ongoing ownership of a converted customer. Distinct from lead ownership.
RM / Relationship
Manager
A CRM ownership concept in Phase 1 — not automatically a login role.
System of record The authoritative store for a data domain. For attendance this is GROTEC HRMS, not the ESSL
device.
Trip Closure Final reconciliation of deliveries, stock, exceptions and kilometres for a dispatch (Phase 2,
§18.3).
Vehicle Stock Product physically loaded into and currently carried by a vehicle (Phase 2).
Taluk An administrative sub-district unit; part of the customer location hierarchy.

-- 23 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 24 of 25
Appendix B — Consolidated State Machines
Collected here so QA can test each independently of its narrative section.
B.1 Call status (§6.3.3, provider-dependent)
Dialing ──→ Ringing ──→ Connected ──→ Ended
│
└──────→ Not Answered
B.2 Call outcome and next action (§6.3.6–6.3.7)
Call ends
│
├── Interested ──→ [modal: exactly one required]
│ ├── Callback → date + time + reason → Follow-up record
│ └── Sales → CRM progression
│ → RM ownership
│ → automatic product communication
│
├── Not Interested ──→ stored; history retained; no modal
│
└── Not Answered ──→ attempt recorded; future follow-up allowed
(retry rules remain OPEN)
B.3 Attendance approval (§7.5)
Mark Entry → Pending → Approval → Approved
│
└────→ Rejected + reason
B.4 ESSL attendance data flow (§7.6)
ESSL Device → Connector/API → Attendance Processing → Attendance Records
↓
Correction / Approval
↓
Payroll
B.5 Monthly payroll (§7.8.4)
Idle → Generate → Generated → Approve & Lock → Approved → Publish → Published
B.6 Ownership hand-off (§6.4)
AGENT: Prospect → Contact → Interested → Sales/Conversion
│
▼
RM: Customer Ownership → Ongoing Relationship → Repeat Business
Appendix C — Items Requiring Confirmation
Observed while consolidating the source material. None has been changed in the requirement text. Each is
raised for the document owner to accept, correct or dismiss at approval.

-- 24 of 25 --

GROTEC FarmerOS — Phase 1 PRD · v2.1
Confidential · Page 25 of 25
Observation Location Suggested resolution
Total Revenue is listed as a Phase 1 CRM-linked KPI
metric, but the sales transaction module that produces
revenue is explicitly Phase 2 scope. It is unclear what
populates this figure in Phase 1.
§7.4.1, §4.2 Confirm the Phase 1 data source for
revenue, or defer the metric to Phase 2
and record the change.
The v1.0 role matrix and scope-summary tables were
malformed, with cell values shifted out of alignment with
their row labels. The matrix in §5.2 is a reconstruction
based on the surrounding role narrative (§5.1).
§4.1, §5.2 Verify §5.2 row by row before approval.
Its accuracy depends on the
reconstruction being correct.
"Manager/Admin — KPI configuration" is marked Partial
without the boundary being defined anywhere in the
document.
§5.2 Define what "Partial" permits, or fold the
decision into the Founder-restricted
boundary open item.
The v1.0 Telecaller/Agent row for HRMS Attendance read
"No (own attendance only)", which is internally
contradictory. It is stated here as "Own attendance only".
§5.2 Confirm the intent: cannot administer
attendance, can view/mark own.
No measurable service levels exist anywhere in the
document — response time, concurrency, uptime,
retention.
§13 Agree targets before the build is
contracted against them. Deliberately not
invented here.
Ownership rules must prevent reassignment "unless an
authorised workflow permits it", but no such authorised
workflow is specified in Phase 1 scope.
§6.4 Confirm whether the authorised
reassignment workflow is in Phase 1 or
deferred.
The Phase 2 source material places Manager and Founder
dashboards plus an Exception Centre in its own final build
stage, while this PRD lists the Founder Control Tower as
Phase 3 (§4.2, §19).
§18.1, §19 Confirm which management-visibility
features land in Phase 2 and which are
held for the Phase 3 Control Tower.
The Phase 2 source introduces a Relation / Call Executive
role receiving field leads, which overlaps the Phase 1
Relationship Manager ownership concept and its open
item on becoming a login role.
§6.4, §18.4 Confirm whether these are the same role
before Phase 2 role design begins.
The Phase 2 source does not cover Purchase (supplier
master, PO, GRN). That scope is carried forward from the
original roadmap, not from the new document.
§18.1 Confirm Purchase remains in Phase 2.
v1.0 §12.6 referred the ESSL open dependency to the
Audit & Security section; the dependency list was
elsewhere.
— Corrected in this version — the reference
now points to Dependencies (§15). No
requirement change.
This PRD is the implementation-ready reference for Phase 1 delivery. The original GROTEC FarmerOS requirement
brief and the HRMS feature documentation remain source references for any detail not yet finalised above.

-- 25 of 25 --



