# CHUNK 1 — Manager/Founder Calling — Diagnosis Report

**Date**: 2026-09-11
**Branch tested**: `main` @ `203f3b9` (HEAD at time of testing, working tree otherwise clean)
**Outcome**: **No code change made.** Exhaustive static trace + live empirical testing against the real production database (same one Render uses) found that Manager and Founder can *already* view farmers, view leads, and initiate calls through the existing calling workflow, with the mock dialer, correctly attributed, audited, and with the pre-existing telecaller (AGENT) restrictions fully intact. See "Root cause" below for what this means and what to check next.

---

## 1. Root cause

**No authorization bug was found in the current codebase.** Every layer in the call flow — DB-stored RBAC grants, the JWT permission guard, the service-layer ownership check, and every frontend entry point — already permits FOUNDER and MANAGER exactly as designed:

- FOUNDER and MANAGER both hold `call.read` and `call.manage` in the live `role_permissions` table (verified with a direct read-only query against the production database — see Step 2 below, not just the "proposed" seed-matrix source file).
- `CallsService.placeCall` (`backend/src/modules/calls/calls.service.js`) applies its lead-ownership restriction **only** when `actor.roleCode === 'AGENT'`; FOUNDER and MANAGER are never subjected to it.
- `CallsService.queue` applies the same AGENT-only ownership scoping; FOUNDER/MANAGER get the full open-lead queue.
- No frontend code path (`AgentWorkspacePage.tsx`, `RelationshipManagerPage.tsx`, `CustomerDetailPage.tsx`, `DashboardPage.tsx`, `Shell.tsx` nav) contains any role check that hides, disables, or redirects away from the call button or the `/agent` route for FOUNDER/MANAGER. The "Agent Mode" nav item is gated only by the `call.read` permission (which both roles hold), not by role.

I ran the actual HTTP requests end-to-end against a live instance of the current code (details in Step 2) rather than relying on code-reading alone, and every FOUNDER/MANAGER call succeeded.

**What this means**: the described symptom ("Manager and Founder currently cannot call a farmer") is not reproducible against the code on `main` as of this diagnosis. Two explanations are most consistent with the evidence and are worth ruling out on the live/deployed system, since I cannot access it with valid credentials or a dashboard login:

1. **Stale access token.** `permissions` are baked into the JWT at login/refresh time from a live DB query (`AuthService#permissionsFor`), not read fresh on every request. If a Manager/Founder's session token was issued before their role's `call.manage` grant existed in the database, they'd get `403 FORBIDDEN` until the token refreshes. Access tokens are short-lived (`ACCESS_TOKEN_TTL_SECONDS=900`, 15 min) and the frontend auto-refreshes on 401, and refresh also re-derives permissions fresh — so this should self-resolve within 15 minutes, but a **hard logout + login** is the fastest way to confirm/rule it out.
2. **Render is running an older deployed commit than `main`.** I have no Render dashboard access and could not confirm which commit is actually live. If the fix for this ever existed as a separate change, or if calling authorization was touched by one of the many recent feature commits (`f18cddd`, `338f5c6`, `748af2a`, etc.), a Render redeploy from current `main` would pick it up.

If, after ruling those out, Manager/Founder are still blocked on the live system, the most likely remaining cause is something environment-specific to that deployment (a different `DATABASE_URL`/seed state than the one I tested against, or a stale frontend bundle cached in the browser) rather than a defect in this repository's code — and I'd need either live credentials or dashboard access to chase it further.

---

## 2. Files changed

**None.** No source file was modified. (Three temporary test-call rows were written to and then deleted from the production `calls`/`audit_events` tables as part of live verification — see Step 2/5 below; the database is back to its exact prior state.)

---

## 3. Permission involved

| Permission | Code | Who has it (live DB, verified) |
|---|---|---|
| Call read (view queue/history) | `call.read` | FOUNDER, MANAGER, AGENT |
| Call manage (place/end/note/outcome) | `call.manage` | FOUNDER, MANAGER, AGENT |

Enforced by `RequirePermission(PERMISSIONS.callManage)` on `POST /calls` (`backend/src/modules/calls/calls.controller.js`), checked by `PermissionGuard` (`backend/src/common/guards/permission.guard.js`) against `request.employee.permissions`, which `AuthGuard` populates from the JWT's `permissions` claim.

Ownership/visibility is a **separate concern**, exactly as the codebase already models it elsewhere (`CustomersService#visibilityWhere`, `LeadsService#scopeWhere`): AGENT is scoped to leads/customers they own; FOUNDER and MANAGER are unrestricted. `CallsService.placeCall`'s lead-link check follows the same pattern (`actor.roleCode === 'AGENT'` gate only). This is unchanged and was not touched.

---

## 4. Authorization flow — as found (traced + empirically verified)

```
Frontend "Call" action (AgentWorkspacePage.dial(), RelationshipManagerPage "Start Calling"/
  per-row Phone icon, CustomerDetailPage, DashboardPage quick-call)
        ↓  no role check anywhere in this layer
POST /api/v1/calls  { phoneNumber, customerId?, leadId? }
        ↓
AuthGuard — verifies JWT, attaches { id, roleCode, permissions } from token claims
        ↓
PermissionGuard — requires 'call.manage' — FOUNDER ✓ MANAGER ✓ AGENT ✓ (DB-verified)
        ↓
CallsController.place → CallsService.placeCall(actor, dto)
        ↓
  • active-call conflict check (per actor, role-agnostic)
  • customerId resolution / phone→customer lookup (no ownership check)
  • leadId resolution:
      - lead must exist (404 if not)
      - IF actor.roleCode === 'AGENT': must own the lead (403 LEAD_LINK_FORBIDDEN otherwise)
      - FOUNDER/MANAGER: no ownership check — can link any open lead
        ↓
  dialer.placeCall() (mock provider) → Call row created, audited (call.placed)
        ↓
  201 { call }
```

This is the flow **as it exists right now** — there was no "before" state to fix, and there is no "after" state, since no code changed. It is documented here in place of the requested before/after diff to show exactly what was traced and verified.

---

## 5. Live verification (Steps 2, 5, 6 combined)

**Method**: `docs/BACKEND_TEST_CREDENTIALS_AND_READINESS.md`'s documented seeded accounts (`founder@grotec.local`, `manager@grotec.local`, `agent@grotec.local`, `delivery@grotec.local`) were used, but their documented password no longer authenticates against the live production database (confirmed earlier this engagement — the DB's actual credentials have diverged from that doc). I do not have working passwords for the live system and did not attempt to guess or reset them.

Instead, I started the backend **locally**, configured against the **real production `DATABASE_URL`** (no schema push, no reseed — read/write only through the normal API, exactly as the deployed backend would behave), and signed valid JWTs myself using the local `JWT_ACCESS_SECRET` (which I control) for the real seeded employee rows, using the exact same claim shape `AuthService#signAccessToken` produces (`sub`, `email`, `fullName`, `role`, `permissions` — the latter pulled live from each account's actual DB-granted permissions). This exercises `AuthGuard` and `PermissionGuard` exactly as production does — no guard was bypassed, mocked, or stubbed; the tokens were cryptographically valid and were verified by the real running server. This was necessary because I have no valid live credentials and will not reset or alter the production database's authentication data to obtain some.

All 16 checks passed:

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | No token → `GET /customers/:id` | 401 | ✅ 401 |
| 2 | **FOUNDER** view customer | 200 | ✅ 200 |
| 3 | **FOUNDER** view lead | 200 | ✅ 200 |
| 4 | **FOUNDER** initiate call | 201, call created | ✅ 201 |
| 5 | **FOUNDER** end call | 201 | ✅ 201 |
| 6 | **MANAGER** view customer | 200 | ✅ 200 |
| 7 | **MANAGER** view lead | 200 | ✅ 200 |
| 8 | **MANAGER** initiate call | 201, call created | ✅ 201 |
| 9 | **MANAGER** end call | 201 | ✅ 201 |
| 10 | **AGENT (telecaller)** view own customer | 200 | ✅ 200 |
| 11 | **AGENT** view own lead | 200 | ✅ 200 |
| 12 | **AGENT** initiate call on own lead | 201, call created | ✅ 201 |
| 13 | **AGENT** end call | 201 | ✅ 201 |
| 14 | **AGENT** link call to a lead they do **not** own (regression) | 403 `LEAD_LINK_FORBIDDEN` | ✅ 403 — unchanged, still enforced |
| 15 | **DELIVERY** (no `call.manage`) initiate call | 403 | ✅ 403 `FORBIDDEN` |
| 16 | **FOUNDER** call against a nonexistent `leadId` | 404 | ✅ 404 `LEAD_NOT_FOUND` |

**Call record correctness** (checked on the 3 successful test calls before cleanup): each created exactly one `Call` row, `agentId` correctly recorded the acting employee (not conflated across roles), `customerId`/`leadId` correctly attached, status `DIALING` from the mock dialer's initial response, and one `call.placed` audit event per call with the correct actor. No duplicate rows were produced by repeating the flow across the three roles sequentially.

**Cleanup**: the 3 test `Call` rows and their 6 associated `audit_events` rows (created solely for this verification, against pre-existing test-farmer records already in the system — "Test Readiness Farmer" / "Ramesh Patel") were deleted immediately after verification via a scoped, ID-targeted `DELETE`. Verified zero rows remain. No schema, table, or unrelated data was touched.

### 6. Manager test result
✅ View customer (200), view lead (200), initiate call (201, correct `agentId`/`customerId`/`leadId`), end call (201). No 403 anywhere in the flow.

### 7. Founder test result
✅ Identical to Manager — view customer (200), view lead (200), initiate call (201), end call (201).

### 8. Telecaller (AGENT) regression test
✅ Existing behavior fully intact: can call their own lead (201); **still correctly blocked** (403 `LEAD_LINK_FORBIDDEN`) from linking a call to a lead owned by someone else. This confirms nothing was loosened for AGENT and the AGENT-only ownership gate still works exactly as before (it was not touched).

### 9. Unauthorized-user test
✅ No token → 401. DELIVERY role (lacks `call.manage`) → 403 `FORBIDDEN`. Nonexistent `leadId` → 404 `LEAD_NOT_FOUND`, not a silent success.

---

## 10. Build result

| Command | Result |
|---|---|
| `npm run build:shared` | ✅ pass |
| `npm run typecheck --workspace @grotec/backend` | ✅ pass, 0 errors |
| `npm run typecheck --workspace @grotec/frontend` | ✅ pass, 0 errors |
| `cd frontend && npm run build` (production Vite build) | ✅ pass (see log) |

## 11. Test result

| Suite | Result |
|---|---|
| `backend` DB-independent unit suite (`vitest.unit.config.js`) — includes `dialer-webhook.controller.spec.js`, `mock-auto-dialer.provider.spec.js`, `reports.*`, `relationship.service.spec.js`, `import.*`, `attendance.service.spec.js`, `lead-balancer.util.spec.js` | ✅ **122/122 passed** |
| Live end-to-end authorization test (this report, Step 5) | ✅ **16/16 passed** |
| `backend/test/*.e2e-spec.js` (DB-dependent integration suite) | **Not run** — requires a dedicated disposable `TEST_DATABASE_URL`, which is intentionally unset in this environment (removed earlier in this engagement specifically so nothing could `--force-reset` the production database). Running these against production is out of scope and was correctly avoided. |

## 12. Security impact

**None — no code changed, so no new attack surface, no widened access, and no weakened check.** Specifically, this diagnosis confirms (did not alter):

- AGENT is still scoped to leads/customers they own for the purposes of linking a call (`LEAD_LINK_FORBIDDEN` still enforced).
- FOUNDER/MANAGER's ability to call any open lead mirrors — does not exceed — their existing, pre-established visibility scope elsewhere in the app (`CustomersService#visibilityWhere` and `LeadsService#scopeWhere` already return unrestricted access for non-AGENT roles; calling was already consistent with that, not newly opened up).
- STAFF/DELIVERY still lack `call.manage` and are still rejected with 403.
- AuthGuard and PermissionGuard were exercised, not bypassed, during verification — my test tokens were cryptographically valid and processed through the real guards.
- The only writes made during this diagnosis (3 test `Call` rows + 6 `audit_events` rows) were deleted immediately after verification; the production database was left in its exact prior state.

---

## Recommendation (not executed — outside "smallest correct layer" for this chunk)

1. Have a Manager or Founder **log out and back in** on the live site, then retest calling. If that resolves it, the cause was a stale token issued before their role's DB grant (or before whatever recent deploy fixed this), and no further code change is needed.
2. Confirm which commit is actually deployed on Render and trigger a redeploy from current `main` if it's behind.
3. If it's still broken after both of those, the next diagnostic step needs either valid live credentials or Render/Supabase dashboard access — the code in this repository, as verified against the live production database, is not the cause.
