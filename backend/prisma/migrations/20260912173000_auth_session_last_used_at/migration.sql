-- ---------------------------------------------------------------------------
-- Backend-enforced idle-session suspension: add auth_sessions.last_used_at.
-- ---------------------------------------------------------------------------
-- Supports the session-idle-timeout feature: AuthGuard (backend/src/common/
-- guards/auth.guard.js) touches this column, throttled, on every authenticated
-- request the access token minted for a session is used on. AuthService
-- #rotateSession (backend/src/modules/auth/auth.service.js) reads it at
-- refresh time and refuses to reissue a session that has been idle past
-- SESSION_IDLE_TIMEOUT_SECONDS (default 900s / 15 minutes), independent of
-- whether the client's own idle timer ever got a chance to run.
--
-- Additive, non-breaking: a NOT NULL column with a DEFAULT, so existing rows
-- backfill to the migration's run time (a reasonable "last known good" value —
-- an existing session is presumed active until proven idle at its next use)
-- and every future INSERT already supplies it implicitly via the default.

ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
