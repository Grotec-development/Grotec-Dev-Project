# CHUNK 1B — Live Manager/Founder Calling Verification

**Date**: 2026-09-11
**Scope**: Verification only, per explicit instruction. **No code changed. No RBAC changed. No database written to** (one credential-free, unauthenticated negative-test request was made against the live API — see Step 7 — which by definition could not and did not mutate any data).

---

## 1. Current Git commit

```
git rev-parse HEAD
203f3b9a5cb3975af6c8953a2bb38d191d706252

git log -5 --oneline
203f3b9 fix(frontend): proxy /api/* through Vercel to the Render backend
40a4ab2 fix(frontend): exclude /api from SPA rewrite; build @grotec/shared before frontend
e91fd62 fix(frontend): add Vercel SPA rewrite so non-root routes don't 404
7c63e86 fix(docker): run compiled dist/ instead of src/ with @swc-node/register
c0353d2 fix: import EmployeeStatus/LeadStatus from @grotec/shared in leads.service
```

Working tree is clean at this commit; nothing has been committed or pushed during this verification.

---

## 2. Expected deployment commit / 3. Actual deployed commit

**Backend (Render)**: **Render deployment commit could not be independently verified.** No `render.yaml`, Render CLI, or Render API credentials/token are present in this environment or repository, and I was given no dashboard access. I did not invent a commit SHA.

What I *could* verify without credentials: the live Render API (`https://grotec-dev-project.onrender.com`) is up, its `/api/v1/health` returns `{"status":"ok","db":"up"}`, and `POST /api/v1/calls` without a token correctly returns `401 UNAUTHORIZED` — i.e., the service is live and its `AuthGuard` is active — but this does not identify *which* commit is deployed.

**Frontend (Vercel)**: partially verifiable indirectly. I built the current commit (`203f3b9`) locally and compared the content-hashed asset filenames Vite produced against what the live Vercel URL actually serves:

| Asset | Live Vercel | Fresh local build of `203f3b9` |
|---|---|---|
| Main bundle | `assets/index-BHCDDGXn.js` | `assets/index-BHCDDGXn.js` |
| Stylesheet | `assets/index-BISFn9Ws.css` | `assets/index-BISFn9Ws.css` |
| Router vendor chunk | `assets/vendor-router-BtBsao_X.js` | `assets/vendor-router-BtBsao_X.js` |
| Query vendor chunk | `assets/vendor-query-5dcFoGNS.js` | `assets/vendor-query-5dcFoGNS.js` |
| Icons vendor chunk | `assets/vendor-icons-CZC70aea.js` | `assets/vendor-icons-CZC70aea.js` |

**Every hash matches exactly.** Since Vite derives these hashes from file content, this is strong evidence the Vercel deployment is serving the frontend build of the current commit, not a stale one. (This is corroborating evidence, not a commit-SHA confirmation from Vercel itself, which I also have no dashboard/API access to.)

---

## 3. Production database permission state (read-only)

Re-ran the same read-only query as Chunk 1, directly against production `DATABASE_URL`, no writes:

```sql
SELECT r.code AS role_code, p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.code IN ('FOUNDER','MANAGER','AGENT','DELIVERY')
  AND p.code IN ('call.read','call.manage')
ORDER BY r.code, p.code;
```

| Role | `call.read` | `call.manage` |
|---|---|---|
| **FOUNDER** | ✅ granted | ✅ granted |
| **MANAGER** | ✅ granted | ✅ granted |
| **AGENT** | ✅ granted | ✅ granted |
| **DELIVERY** | ❌ not granted | ❌ not granted |

Matches every expectation in Step 3 exactly. No rows were inserted, updated, or deleted.

---

## 4. JWT permission flow (inspected — `backend/src/modules/auth/auth.service.js`)

```
POST /auth/login (email, password)
  → AuthService.login()
  → verifyPassword(...)
  → permissionsFor(employee.roleId)
      → SELECT role + role.rolePermissions (live DB query, every login/refresh)
      → returns { role, permissions: string[] }
  → signAccessToken(employeeId, email, fullName, role.code, permissions)
      → jwt.sign({ sub, email, fullName, role, permissions }, JWT_ACCESS_SECRET, { expiresIn: 900 })
  → accessToken returned to client (kept in memory/localStorage by the frontend, per api.ts)
  → refresh token (opaque, hashed) stored server-side, delivered as an httpOnly cookie

Every subsequent request:
  Authorization: Bearer <accessToken>
  → AuthGuard.canActivate()
      → jwtService.verifyAsync(token, { secret: JWT_ACCESS_SECRET })
      → request.employee = { id, email, fullName, roleCode, permissions }  (taken directly from the token's claims)
  → PermissionGuard.canActivate()
      → reads @RequirePermission(...) metadata off the route handler
      → checks request.employee.permissions.has(required)
      → 403 FORBIDDEN if missing, otherwise proceeds

POST /auth/refresh (httpOnly refresh cookie)
  → AuthService.refresh()
  → permissionsFor(employee.roleId)   ← re-queries the DB fresh, same as login
  → signAccessToken(...)               ← new access token with current permissions
```

**Confirmed**: permissions are **not** derived dynamically per-request from the database — they are a snapshot taken at the moment a token is issued (login **or** refresh), then trusted as-is by `AuthGuard`/`PermissionGuard` for that token's lifetime. This is a standard, correct JWT pattern — not a bug — but it is exactly the mechanism that can produce a temporary mismatch (Step 5).

**Access token lifetime**: `ACCESS_TOKEN_TTL_SECONDS=900` → **15 minutes**.
**Refresh token lifetime**: `REFRESH_TOKEN_TTL_DAYS=30` → 30 days, httpOnly cookie, rotated on each use (per `AuthService.refresh()`).

---

## 5. Stale-session possibility

**Yes, a currently-open Manager/Founder browser session can be carrying permissions frozen from an earlier token.** Two points in the code make this concrete rather than speculative:

- `frontend/src/lib/api.ts`'s response interceptor only refreshes the access token reactively, **on a `401`** from an API call. It does not proactively refresh on a schedule, and a `403` (wrong permissions, valid token) does **not** trigger a refresh — the interceptor only acts on `status === 401`.
- `frontend/src/auth/AuthContext.tsx` only re-fetches the current user's permissions (`GET /auth/me`, or `POST /auth/login`'s response body) on initial page load or explicit login — not on a timer, not on window focus, not on navigation.

So: if a Manager/Founder's `role_permissions` grant were added or changed **after** their current access token was issued, and their access token has not yet expired or triggered a 401-driven refresh, their browser tab will keep presenting a permission set that is up to 15 minutes stale, and will keep getting `403 FORBIDDEN` on `POST /api/v1/calls` from `PermissionGuard` until one of:
- the access token naturally expires and a `401` triggers the refresh interceptor, or
- they manually log out and back in.

I made no change to authentication to work around this — per instruction. The correct, minimal remediation is procedural:

> **LOG OUT → clear the existing session → LOG IN AGAIN → obtain a fresh access token (which re-queries `role_permissions` live) → retry the call.**

This requires no code change because the code already re-derives permissions correctly at both login and refresh; the issue (if this is what's happening) is purely that an existing token predates the correct grant being in effect for that session.

---

## 6. Frontend call-button trace — every check found

Searched `roleCode`, `role`, `call.read`, `call.manage`, `Agent`, `MANAGER`, `FOUNDER` across every call entry point:

| File | Match | What it actually does | Blocks Manager/Founder calling? |
|---|---|---|---|
| `AgentWorkspacePage.tsx` | `"Agent Mode"` / `"Agent Calling Mode"` (lines 759, 834, 842) | Cosmetic header text only | **No** |
| `RelationshipManagerPage.tsx:38` | `hasPermission('relationship.read')` | Gates the *page itself* (not calling) — redirects to `/restricted` if missing. FOUNDER/MANAGER both hold `relationship.read`. | No — different permission, different page, and both roles have it |
| `RelationshipManagerPage.tsx:45` | `const isFounder = user.roleCode === 'FOUNDER'` | Only used to show the RM-filter dropdown and enable the holders query — UI convenience, not a call-button gate | **No** |
| `RelationshipManagerPage.tsx` (Call CTA, line ~150; per-row Phone icon, line ~345) | `onClick={() => navigate('/agent')}` / `navigate('/agent?phone=...')` | No role check before navigating | **No** |
| `CustomerDetailPage.tsx:28,37,44,51` | `role: 'Telecaller'` / `'Relationship Manager'` | Hardcoded **mock timeline demo data** (`MOCK_TIMELINE`), unrelated to authorization | **No** |
| `DashboardPage.tsx:53,56` | `roleCode === 'DELIVERY'` / `'STAFF'` | Redirects those two roles to a different landing view. Does not mention or affect FOUNDER/MANAGER. | **No** |
| `DashboardPage.tsx:174` | ternary on `FOUNDER`/`MANAGER`/else | Cosmetic workspace title text only | **No** |
| `Shell.tsx:51` | `{ to: '/agent', ..., permission: 'call.read' }` | Nav-item visibility gate — both roles hold `call.read` | **No** (they pass) |
| `Shell.tsx:83-102` (`FOUNDER_HIDDEN_NAV`, `MANAGER_HIDDEN_NAV`) | Explicit hidden-nav sets | `/agent` is **not** in either set (hidden items are `/action-center`, `/leads`, `/knowledge-base`, `/crops`, `/reports`) | **No** |

**No stale, orphaned, or incorrect role/permission check hides or disables the call button for Manager or Founder anywhere in the current frontend code.** This matches Chunk 1's finding and is unchanged.

---

## 7. Live API test

**Could not test Manager/Founder actually placing a call on the live deployed API** — I have no valid credentials for the live system (the documented test password from `docs/BACKEND_TEST_CREDENTIALS_AND_READINESS.md` does not authenticate against production, as already established in Chunk 1), and per the security instructions for this task I will not attempt to guess, brute-force, or otherwise obtain live credentials.

What I *could* test without any credentials (proves the deployed guard chain is live and wired correctly, even though it can't attribute success/failure to a specific role):

```
POST https://grotec-dev-project-frontend.vercel.app/api/v1/calls   (no Authorization header)
Body: {"phoneNumber":"+919999999999"}

HTTP 401
{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}
```

This confirms `AuthGuard` is active and correctly rejecting unauthenticated requests on the live deployment — consistent with everything found locally. It does not confirm what happens for an authenticated Manager/Founder request on Render specifically, because I have no way to authenticate as one.

**If you can supply a valid Manager or Founder access token (not the password — just have them open DevTools → Application → Local Storage → copy the `grotec_access` value) I can send one authenticated, harmless `POST /api/v1/calls` request through the live proxy and report the exact status/error code back to you, without ever seeing or printing the token itself in this report.**

---

## 8. Cache / deployment findings

- **Vite asset hashing**: every JS/CSS file is content-hashed (`index-BHCDDGXn.js`, etc.) — a code change always produces a new filename, so a browser can never silently keep serving old JS under an unchanged URL.
- **Vercel HTML caching**: `Cache-Control: public, max-age=0, must-revalidate` on `/` — the HTML document (which references the hashed asset filenames) is revalidated on every load, never served stale from a browser's local cache.
- **Bundle-hash comparison** (Step 2/3 above): the live Vercel bundle hashes match a fresh local build of the current commit exactly.
- **Service worker / PWA**: a PWA `manifest.webmanifest` exists (icons, `start_url`), but there is **no `serviceWorker.register()` call and no Workbox/`vite-plugin-pwa` dependency anywhere in the frontend**. No service worker is installed, so there is no SW-level cache that could be serving a stale app shell or stale API responses.

**Conclusion**: no evidence of a stale-bundle or caching problem on the frontend. No cache-busting code was added, since none was needed.

---

## 9–11. Recommended action

**For Manager**: log out completely (clears the access token and revokes the refresh-token cookie server-side), then log back in, then retry placing a call. This forces a fresh `role_permissions` query and a new token carrying `call.manage`.

**For Founder**: identical — log out, log back in, retry.

If, after a clean logout/login on the actual live site, either role still cannot place a call, the next diagnostic step is one of:
1. Confirm (via Render dashboard, which I do not have access to) exactly which commit is deployed and redeploy from `main` if it's behind `203f3b9`.
2. Have the affected user open browser DevTools → Network tab, attempt the call, and report the exact HTTP status and response body for `POST /api/v1/calls` — or supply the access token value as described in Step 7 so I can test it directly.

Both of those require information/access this environment does not have; they are not something a further code change here can resolve.

## 12. Were code changes required?

**No.** As instructed: RBAC was not touched, no permission was added, `CallsService` authorization was not modified, and the database was not written to (the one live request made in Step 7 was an unauthenticated negative test that by construction cannot mutate data).

**Conclusion: the repository is functioning correctly. FOUNDER and MANAGER calling permissions, the JWT/guard chain, and the frontend UI are all correct as of commit `203f3b9`, verified both by static trace and by re-running the read-only production-DB permission check from Chunk 1. The remaining issue, if it persists on the live site, is deployment-commit-freshness on Render (unverifiable from here) or user-session token staleness (resolved by logout/login) — not a defect in this code.**
