# CHUNK 2A - Production Calling UI Cleanup

## 1. Objective
Remove frontend demo calling controls and unverified static pricing without changing backend, database, APIs, authentication, permissions, or introducing a pricing source. Status: PASS WITH WARNINGS.

## 2. Demo UI removed
- Removed both workspace buttons: "Demo Live Call" and "Simulate Active Call with Murugan V. (PDF Screen 4)".
- Inspected all references before editing: `startMockActiveCall` was called only by those two buttons. Removed the handler, fabricated connected call, sample notes, and mock-only end/disposition/context bypasses.
- Initialized the elapsed timer at zero instead of the mock 204 seconds. Existing real-call timer updates remain.
- The frontend-wide search also found DashboardPage's `UP_NEXT_QUEUE`: five hardcoded people/phone numbers, three rendered dial buttons, and a fake queue count. Removed these and their exclusive type/navigation handler/import. Kept links to the real calling workspace and an explanatory prompt.
- No frontend source path now constructs a CONNECTED call object. Live call state is supplied by existing API responses.

## 3. PDF/mockup references removed
Removed the simulation button's PDF Screen 4 wording, demo tooltip, and mock handler comments. No calling UI PDF/mockup reference remains. LoginPage retains a JSX-only design comment about PDF mockup Screen 5; it is not rendered text.

## 4. Pricing handling decision
Removed the entire static recommendation panel because its only price source was the local constant. Removed `BIO_INPUT_RECOMMENDATIONS`, selection state, pending-draft selection field, and the knowledge-base Suggest action that only selected these static entries. No new pricing source or backend was introduced.

Preserved guidance fetched from `/assistant/guidance`, including recommended product names, usage guidance, search/filtering, and Insert in Notes. These are existing application records, not the removed price catalog.

Post-change search of frontend/src returned zero matches for each of: `₹450`, `₹650`, `₹800`, `BIO_INPUT_RECOMMENDATIONS`, `Grotec Advisory Formulations`, and `Recommended Bio-Inputs for this Call`. None remains in the production calling screen.

## 5. Real calling functionality preserved
- Shared `/agent` and `/calling` routes and the customer-detail call navigation remain unchanged.
- Queue Call, next-queue dial, and Direct Dial still invoke `dial`, posting the unchanged `{ phoneNumber, customerId, leadId }` payload to `/calls` through the existing `/api/v1` client.
- Both end-call controls still invoke `endCall`, posting to `/calls/:id/end`. Polling, restore, notes, outcomes, and deferred wrap-up remain.
- Manager, Founder, and Agent retain shared call.read/call.manage permissions. No auth, router, permission, controller, service, or ownership files changed.
- Static backend inspection confirms the existing AGENT ownership check rejects an explicitly supplied unowned leadId with LEAD_LINK_FORBIDDEN. Queue dialing still passes leadId. This is not a live authorization test or a claim that every existing direct-number authorization case has been audited.

## 6. Search results and classification
Searched the entire frontend for demo, simulate, mock, MOCK_DIALER, PDF Screen, mockup, Murugan, fake call, and active call (case-insensitive).

| Result/group | Classification and disposition |
| --- | --- |
| Workspace demo buttons/handler, mock-call-1 bypasses and mock timer | A: production demo calling UI/dead code; removed. |
| Dashboard UP_NEXT_QUEUE and sample-number dial actions | A: production mock calling UI; removed. |
| AgentWorkspacePage: two MOCK_DIALER literals | C: existing deferred/queue ENDED-call wrap-up reconstruction. They retain real call IDs and use real notes/outcome/context APIs; neither fabricates a connected call. Provider metadata is not rendered or sent in these requests. Preserved to avoid changing shared real wrap-up behavior. |
| AgentWorkspacePage: active-call restoration notices, resume/return cards, error check | C: legitimate calling UI; retained. |
| AgentWorkspacePage: active-call/mute/workstation comments; AssistantContext active-call comment | D: implementation comments; retained. |
| Shell: Active Call route title/crumb | C: legitimate route metadata; retained. |
| CustomersPage: DISTRICT_MAP Murugan V. entry, mock variable and auxiliary metadata | A: production mock customer-directory metadata, outside calling-control cleanup; retained and flagged for separate cleanup. It does not fabricate a call or supply the calling queue. Associated PDF comment is D. |
| CustomerDetailPage: MOCK_PURCHASES and MOCK_TIMELINE definitions/renderers | A: production mock purchase/history UI, outside calling-control cleanup; retained and flagged for separate cleanup. These do not initiate simulated calls. |
| LoginPage: PDF mockup Screen 5 JSX comment | D: non-rendered design comment; retained. |
| EmployeeProfilePage: sentence explaining revenue is not fabricated with mock data | C: existing informational UI, unrelated to calling; retained. |
| Existing frontend spec fixtures | B: test-only; retained. The keyword search itself found no additional test-only mock call handler. |

No matches remain for Demo Live Call, Simulate Active Call, PDF Screen 4, startMockActiveCall, mock-call-1, or fake call. Murugan V. remains only in the customer-directory auxiliary map. The two wrap-up MOCK_DIALER literals described above remain.

## 7. Build/typecheck results
- `npm run build:shared`: PASS.
- Frontend `npm run typecheck`: PASS on final code. An intermediate check identified a remaining demo-button reference, which was removed before the successful final checks.
- Frontend `npm run build`: PASS, Vite transformed 1,732 modules; no missing component, route import, shared resolution, or TypeScript errors.
- Frontend `npm run test`: PASS, 3 files / 45 tests.
- Build and tests initially hit sandbox `spawn EPERM` from esbuild; approved retries outside the sandbox succeeded.
- Root workspace typecheck also passed. Removed the newly unused Dashboard useNavigate import and exclusive handler. Existing shared workspace icons still have uses. The repository disables noUnusedLocals/noUnusedParameters, so typecheck is not a repository-wide unused-symbol audit.
- `git diff --check`: PASS.

## 8. Calling regression results
PASS for the requested minimum static preservation check and available frontend tests. Existing ui-recreation tests cover queue-filter logic; other frontend tests cover formatting and customer-edit helpers. There is no existing AgentWorkspacePage rendered interaction test. These 45 tests do not prove live telephony or role-specific login behavior.

Manager and Founder retain real customer navigation, workspace dial and end controls, and call permissions. Agent queue dialing retains the real payload and existing explicit-lead ownership enforcement. Removed demo controls have no render references.

Backend calls.e2e-spec.js was inspected but not executed: its global setup runs `prisma db push --force-reset`, creates indexes, and seeds a database. That conflicts with this chunk's no-database-changes constraint. No callable browser automation tool or live credentials were supplied, and no live calls or production records were created.

## 9. Files changed
- frontend/src/pages/AgentWorkspacePage.tsx
- frontend/src/pages/DashboardPage.tsx (only hardcoded calling queue and its exclusive code)
- docs/CHUNK_2A_PRODUCTION_UI_CLEANUP.md

Initial working tree was clean. Reviewed the complete tracked diff and this document. No unrelated changes, backend/database/Prisma/migration/RBAC/auth changes, pricing backend, commit, or push.

## 10. Remaining limitations
Live login/call/end and cross-agent denial were not exercised. Existing wrap-up placeholder metadata and the queue-wrap-up fixed duration remain unchanged in shared legitimate functionality. Customer-directory sample metadata and customer-detail mock purchase/history UI remain outside this calling UI cleanup. No claim is made that all production screens are free of mock data.

The requested report exists locally, but the repository ignores docs/ (.gitignore line 31), so it is absent from ordinary git status/diff. The ignore rules and index were not changed.
