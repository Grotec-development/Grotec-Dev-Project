-- ---------------------------------------------------------------------------
-- Grant FOUNDER the kpi.read permission.
-- ---------------------------------------------------------------------------
-- FOUNDER already carries kpi.manage (configure targets, compute/freeze
-- scores, team-summary) but was missing kpi.read, which gates GET
-- /kpi/targets, /kpi/my/score, /kpi/scores/:employeeId, and their :period
-- variants (see backend/src/modules/kpi/kpi.controller.js). Every other role
-- that touches KPI at all (MANAGER, AGENT, STAFF, DELIVERY) already has
-- kpi.read; FOUNDER — the role with the broadest access in the system — was
-- the one role missing it. This surfaced live as a red "Missing permission:
-- kpi.read" banner on the Team KPI page for the Founder account.
--
-- The code side is already complete and committed: packages/shared/src/
-- permissions.js now lists kpiRead in FOUNDER's permission array. This
-- migration is the only thing missing — the row in the live role_permissions
-- table.
--
-- prisma/seed.js is NOT the tool for this: seedRoles() does
-- rolePermission.deleteMany({ where: { roleId } }) followed by createMany,
-- which rewrites every role's entire permission set from the code matrix and
-- would discard any database-side change made outside a full reseed. This
-- statement is purely additive.
--
-- Properties:
--   * additive     — one INSERT, no UPDATE / DELETE / DROP / TRUNCATE
--   * idempotent   — ON CONFLICT DO NOTHING against the (role_id, permission_id)
--                    primary key, so re-running changes nothing
--   * targeted     — the WHERE clause matches exactly one role and exactly one
--                    permission, so at most ONE row can be inserted
--   * non-creating — it deliberately does not insert into "permissions". The
--                    kpi.read row already exists (MANAGER/AGENT/STAFF/DELIVERY
--                    hold it). If it were somehow absent this inserts 0 rows
--                    rather than inventing a permission.

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" = 'FOUNDER'
   AND p."code" = 'kpi.read'
ON CONFLICT DO NOTHING;
