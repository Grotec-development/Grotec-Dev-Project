# FINAL PRODUCTION SMOKE TEST — GROTEC FarmerOS

**Date**: 2026-09-11
**No code changed. No RBAC changed. No architecture changed. Nothing committed or pushed.**

---

## A. Overall status

# **READY WITH WARNINGS**

The calling defect (Chunks 1E/1F) is fully resolved and verified live. Nothing found in this chunk blocks day-to-day operation. Two items below are genuine, pre-existing gaps worth fixing before calling this a fully hardened production deployment — neither prevents the app from working today.

---

## B. Test matrix

| Test | Expected | Actual | Status |
|---|---|---|---|
| `GET /api/v1/health` | 200, db up | 200, `{"status":"ok","db":"up"}` | ✅ PASS |
| Founder login (current password) | 200 | 200 | ✅ PASS |
| Manager login (current password) | 200 | 200 | ✅ PASS |
| Agent login (current password) | 200 | 200 | ✅ PASS |
| Delivery login (current password) | 200 | 200 | ✅ PASS |
| Founder/Manager/Agent login with *documented* `docs/BACKEND_TEST_CREDENTIALS_AND_READINESS.md` password | — | 401 `INVALID_CREDENTIALS` | ⚠️ Docs stale (see H below) |
| Delivery login with documented password | — | **200** — this is the one account still on the original documented password | ℹ️ Informational, see Section D |
| No-token protected request | 401 | 401 `UNAUTHORIZED` | ✅ PASS |
| `GET /customers/:id` | 200, no P2022 | 200, `soilType` field present and correctly `null` | ✅ PASS |
| `GET /customers` (list) | 200 | 200, paginated results returned | ✅ PASS |
| Manager: place call | 201 | 201 | ✅ PASS |
| Manager: end call | 201 | 201 | ✅ PASS |
| Founder: place call | 201 | 201 | ✅ PASS |
| Founder: end call | 201 | 201 | ✅ PASS |
| Agent: call own lead | 201 | 201 | ✅ PASS |
| Agent: call another agent's lead | 403 | 403 `LEAD_LINK_FORBIDDEN` | ✅ PASS |
| Delivery: call | 403 | 403 `FORBIDDEN — Missing permission: call.manage` | ✅ PASS |
| Delivery: view customer | — | 403 (lacks `customer.read` too) | ℹ️ Consistent, stricter than required |
| `npx prisma migrate status` | up to date | "Database schema is up to date!" | ✅ PASS |
| Audit events per call | 2 (`call.placed`, `call.ended`), correct actor | 6 rows for 3 calls, correct actors, 0 duplicates | ✅ PASS |
| `npm run build:shared` | pass | pass | ✅ PASS |
| Backend typecheck | pass | pass, 0 errors | ✅ PASS |
| Frontend typecheck | pass | pass, 0 errors | ✅ PASS |
| Frontend production build | pass | pass, 7 output files, no errors | ✅ PASS |
| Backend unit suite | pass | 122/122 | ✅ PASS |
| Committed `.env` files | none | none found | ✅ PASS |
| Hardcoded secrets in source | none | none found | ✅ PASS |
| Demo/fake live-call UI | none expected in prod | **found — see I** | ❌ FAIL |
| Hardcoded product/pricing on call screen | none expected | **found — see I** | ❌ FAIL |
| Render CORS allows Vercel origin directly | — | still does not (pre-existing, not a regression) | ⚠️ KNOWN LIMITATION |
| Automated migration deploy in CI/CD | — | **not present** — see K/L | ⚠️ PROCESS GAP |

---

## C. Production database status

`npx prisma migrate status`: **up to date, zero pending migrations.** All 49 Prisma models re-verified against live schema in Chunk 1F — zero drift, not re-run in this chunk since nothing changed the schema since then. The three migrations applied in Chunk 1F remain in place and stable.

## D. Authentication status

All 5 seeded accounts (Founder, Manager, Agent, Staff\*, Delivery) exist, are `ACTIVE`, and have correctly-formed password hashes. Four of five (Founder, Manager, Agent, and — separately — Delivery) authenticate successfully, but **not all with the same password**: Founder/Manager/Agent share one password; Delivery still uses a different, older one (the one actually documented in `docs/BACKEND_TEST_CREDENTIALS_AND_READINESS.md`). Per explicit instruction, **I did not change Delivery's password to make it uniform** — this is informational only, not a defect (it does not prevent Delivery from logging in; it logs in fine with its own password).

\*Staff was not part of this test matrix (not involved in calling).

## E. Authorization status

Every boundary tested holds:
- Unauthenticated → 401
- Manager/Founder permitted operations → succeed
- Agent own-resource → succeeds; Agent other-agent's-resource → 403
- Delivery calling → 403 (and Delivery customer-read → 403, which is even stricter than the minimum required — not a bug, just extra restriction from lacking `customer.read` too)

No RBAC was changed to make any of this pass — these are the same grants verified read-only in Chunks 1, 1C, 1E, 1F.

## F. Calling status

Fully working end-to-end for all four roles, live, right now: Founder ✅, Manager ✅ (the original defect — now confirmed fixed), Agent (own lead) ✅, and both negative cases (Agent/other-lead, Delivery) correctly blocked.

## G. Audit status

For the three real test calls placed in this chunk: exactly 6 audit rows (`call.placed` + `call.ended` per call), correct `actor_id` for each (Manager's id on Manager's call, Founder's on Founder's, Agent's on Agent's), correctly ordered timestamps, zero duplicates. All three test calls and their audit rows were deleted immediately after verification (matching the cleanup discipline from every prior chunk) — production data is unchanged except for the legitimate migration-driven schema/permission additions from Chunk 1F.

Calls do not use the transactional outbox in this architecture — confirmed again by inspecting `CallsService`: it writes directly via `AuditService.record()` inside the same Prisma transaction as the call row, not through `DomainEventService`/outbox. The `outbox_events` table exists and is used for other domain events (customer/lead/relationship/payroll lifecycle), untouched by this chunk.

## H. Frontend build status

`npm run build` (frontend): clean, 1732 modules transformed, no TypeScript errors, no Vite errors. `@grotec/shared` resolves correctly via the `prebuild` hook added in the Vercel audit chunk. The only `localhost` references anywhere in `frontend/src` are two dead conditions in `main.tsx`'s link-interceptor allow-list (`http://localhost:5173`/`:3000`) — cosmetic, never true in production, does not block deployment (already identified in an earlier chunk, unchanged).

## I. Configuration/security findings

**Clean:**
- No `.env` files tracked in git; `.gitignore` correctly covers `.env`, `.env.*`, `node_modules/`, `.pgdata/`.
- No hardcoded API keys, connection strings, or passwords found anywhere in tracked backend or frontend source. The only matches for credential-shaped strings are inside `structured-logger.spec.js` — synthetic fixture data used to test the log-redaction utility itself, not real secrets.
- No demo/autofill credentials embedded in `LoginPage.tsx`.
- The eSSL attendance sync (`AttendanceService.syncEssl`) requires real, registered, active ESSL devices in the database and real punch data; it throws `NO_DEVICES` rather than fabricating attendance records when none are configured. No fake-data-generation behavior found.

**Not clean — two real findings, per Section 10's explicit checklist:**

1. **A literal "Demo Live Call" button ships in production**, in the Direct Dial panel of the calling workspace (`frontend/src/pages/AgentWorkspacePage.tsx:2065-2072`), tooltip *"Simulate active call from mockup"*. It fabricates an entirely client-side fake call (`status: 'CONNECTED'`, fake farmer name "Murugan V.", fake phone number, `provider: 'MOCK_DIALER'`) with **zero backend request** — indistinguishable in the UI from a real connected call. It is unconditionally visible; nothing gates it behind a dev/staging flag.
2. **A second, related instance**: when an agent's calling queue is empty, the empty-state UI (same file, lines 1980-1990) shows a button labeled **"Simulate Active Call with Murugan V. (PDF Screen 4)"** — the same fake-call function, plus a literal reference to a presentation-deck screen number left in the shipped label text.
3. **Hardcoded product/pricing information is shown live during real calls**: `BIO_INPUT_RECOMMENDATIONS` (lines 81-85) is a static array — three products with fixed prices (₹450/L, ₹650/kg, ₹800/bag) — rendered under "Recommended Bio-Inputs for this Call" / "Grotec Advisory Formulations" (line ~1592-1601) on the live call screen. It's not fetched from any backend/pricing API, so if these prices go stale, agents will quote outdated prices to real farmers with no mechanism to catch it short of a frontend redeploy.

Per instruction, **none of these were fixed in this chunk** — reporting only.

**"Agent Mode visible error"**: could not verify — this requires an actual rendered browser session, which I don't have. Static review of the error-handling code in `AgentWorkspacePage.tsx` shows `error` state is correctly initialized to `null` and only set inside caught-exception handlers (cleared before each new action), so nothing in the code itself suggests a stray always-on error banner — but I can't rule out a runtime-only issue without a live browser. Marking **NOT VERIFIABLE** rather than guessing PASS or FAIL.

## J. Known limitations

- Delivery's login password differs from the other four seeded accounts (Section D) — informational, not a defect.
- Render's `CORS_ORIGINS` does not include the Vercel frontend origin directly (confirmed again this chunk via a fresh preflight check — no `access-control-allow-origin` header returned). Not currently a problem because the app works entirely through the Vercel `/api` proxy (same-origin from the browser's perspective, established in the Vercel-deployment audit chunk) — but if anything ever calls Render directly from a browser, it will be CORS-blocked.

## K. Remaining blockers

**None that prevent the app from functioning today.** Two items are real but non-blocking:

1. **The three UI items in Section I** (two demo-call buttons, one hardcoded pricing panel) are real production-facing issues, not merely cosmetic — they can mislead agents into thinking a fake call is real, or into quoting stale prices to a real farmer on a real call. Recommend a dedicated cleanup chunk.
2. **There is no automated migration-deployment step anywhere in the pipeline** (see L) — this is the process gap that caused the original 3-day migration drift and calling outage in the first place. Without fixing this, the same class of failure can recur on the next feature deploy.

## L. Exact deployment prerequisites

For the current fix specifically: **none** — it's already live and verified.

For long-term production health, going forward:

1. **Add an automated `prisma migrate deploy` step to the deploy pipeline.** Currently `backend/Dockerfile`'s build stage runs `prisma generate` (syncs the generated client code) but **never runs `prisma migrate deploy`** (which syncs the actual database schema) — at build time or at container start. This is the root mechanism that let migrations silently fall behind for 3+ days. Two standard ways to fix it, either is fine: (a) if Render supports a "Pre-Deploy Command" separate from the start command, set it to `cd backend && npx prisma migrate deploy`; (b) chain it into the container start, e.g. `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]`. Not implemented in this chunk — it's a process/infra change, out of scope for a smoke-test audit, and flagged here per instruction rather than acted on.
2. Confirm on Render's dashboard whether `CORS_ORIGINS` is set at all, and if a direct (non-proxied) API consumer is ever planned, add the Vercel origin there.
3. Environment variables required for a from-scratch deploy (names only, already configured on the live systems, not re-derived here): `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `CORS_ORIGINS`, `FOUNDER_EMAIL`, `FOUNDER_PASSWORD`, `SEED_EMPLOYEES`, `ESSL_WEBHOOK_SECRET`, `DIALER_*`, `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY` — all already live and working; nothing new required for the current fix to function.

---

## Summary

**READY WITH WARNINGS.**

**Blockers:** none.

**Non-blocking issues:**
1. Two fake "demo call" UI elements and one hardcoded product-pricing panel ship in the production calling screen.
2. No automated migration-deploy step in the pipeline — the structural cause of the original outage, still unaddressed.
3. Render's CORS doesn't list the Vercel origin (masked by the current proxy setup, not currently causing a problem).
4. Delivery's password differs from the other four seeded accounts (informational only).

**Recommended next chunk:** a dedicated cleanup pass on the three UI findings in Section I (remove or properly gate the demo-call buttons, replace the hardcoded pricing panel with a real data source or at minimum a clearly-marked placeholder), and a small infra chunk to add `prisma migrate deploy` to the deploy pipeline so this class of bug can't recur.
