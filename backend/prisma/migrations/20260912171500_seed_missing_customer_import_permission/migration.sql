-- ---------------------------------------------------------------------------
-- Correction to 20260912170000_rbac_full_reconcile_and_super_admin.
-- ---------------------------------------------------------------------------
-- That migration assumed customer.import already existed as a row in
-- "permissions" (every other permission code referenced by the FOUNDER/MANAGER/
-- SUPER_ADMIN matrices did) and only granted it via role_permissions. Verifying
-- after deploy showed that assumption was wrong: the live "permissions" table
-- has 51 rows, one short of PERMISSION_CODES' 52 — customer.import was never
-- seeded at all, so the prior migration's role_permissions INSERT ... SELECT
-- joined against zero rows and granted nothing.
--
-- This migration creates the missing permission row (module derived the same
-- way prisma/seed.js's seedPermissions() does: code.split('.')[0]) and then
-- grants it to FOUNDER, MANAGER, and SUPER_ADMIN — the three roles whose code
-- matrix in packages/shared/src/permissions.js includes customer.import.
--
-- Properties: additive (INSERTs only), idempotent (ON CONFLICT DO NOTHING
-- throughout), targeted (grants only the 3 roles that should hold it).

INSERT INTO "permissions" ("id", "code", "module", "description", "created_at")
VALUES (gen_random_uuid(), 'customer.import', 'customer', 'Permission customer.import', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" IN ('FOUNDER', 'MANAGER', 'SUPER_ADMIN')
   AND p."code" = 'customer.import'
ON CONFLICT DO NOTHING;
