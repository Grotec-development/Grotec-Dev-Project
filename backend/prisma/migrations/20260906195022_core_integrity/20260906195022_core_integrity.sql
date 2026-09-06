-- Checkpoint B: Core DB integrity.
-- Migration ID: 20260906195022
-- Run after: 20260905120000_hrms_foundation
--
-- Contents:
--   1. relationship_ownership partial unique index (one active RM per customer)
--   2. auth_sessions tokenHash index (fast rotateSession / logout lookups)
-- 1. One active relationship manager per customer (RM invariant, mirrors lead_ownership).
-- 2. Index on auth_sessions.token_hash for fast rotateSession/logout lookups.
--    The index is NOT unique yet: it is keyed by sha256 of the token, and rotating
--    sessions are immediately revoked, so collisions are practically zero but the
--    storage engine should not assume it. A unique constraint can be added later
--    if observed history proves safe.

-- A customer has exactly one CURRENT relationship manager.
CREATE UNIQUE INDEX "relationship_ownership_current_customer_idx"
  ON "relationship_ownership" ("customer_id") WHERE "released_at" IS NULL;

-- Fast lookup by refresh-token hash during rotation and logout.
CREATE INDEX "auth_sessions_token_hash_idx"
  ON "auth_sessions" ("token_hash");
