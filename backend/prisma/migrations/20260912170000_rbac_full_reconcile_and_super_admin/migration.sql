-- ---------------------------------------------------------------------------
-- Full RBAC reconciliation + SUPER_ADMIN role.
-- ---------------------------------------------------------------------------
-- Part 1: reconcile every existing role's live grants against the code's
-- intended matrix (packages/shared/src/permissions.js). An audit script
-- comparing role_permissions to PROPOSED_ROLE_PERMISSIONS for all 5 roles
-- found exactly one gap (the same class of drift as the kpi.read fix in
-- 20260912100000_founder_kpi_read): FOUNDER and MANAGER's code-level matrices
-- both list customer.import, but the live DB rows were never created for it.
-- No role currently holds a DB grant that ISN'T in its code matrix, so there
-- is nothing to revoke here — this migration only adds rows.
--
-- Part 2: add SUPER_ADMIN, a break-glass role that sits above FOUNDER in the
-- hierarchy (ROLE_RANK.SUPER_ADMIN = -1, see packages/shared/src/roles.js)
-- and holds literally every permission the system defines. This is purely
-- additive: a new role row plus new role_permissions rows. It grants no
-- access to anyone until an employee is actually assigned this role.
--
-- Properties:
--   * additive     — INSERTs only, no UPDATE / DELETE / DROP / TRUNCATE
--   * idempotent   — re-running changes nothing (ON CONFLICT DO NOTHING on
--                    role_permissions; the SUPER_ADMIN role insert is guarded
--                    by a NOT EXISTS check since roles.code has no unique
--                    constraint usable with ON CONFLICT here... it does — see
--                    below — but NOT EXISTS is used for clarity either way)
--   * non-creating — does not insert new rows into "permissions"; SUPER_ADMIN
--                    is granted only permission codes that already exist

-- Part 1: FOUNDER + MANAGER customer.import backfill.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" IN ('FOUNDER', 'MANAGER')
   AND p."code" = 'customer.import'
ON CONFLICT DO NOTHING;

-- Part 2a: create the SUPER_ADMIN role if it doesn't already exist.
-- roles.code has a UNIQUE constraint, so ON CONFLICT is usable directly.
INSERT INTO "roles" ("id", "code", "name", "updated_at")
VALUES (gen_random_uuid(), 'SUPER_ADMIN', 'Super Admin', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Part 2b: grant SUPER_ADMIN every permission that currently exists.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
