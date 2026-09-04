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


