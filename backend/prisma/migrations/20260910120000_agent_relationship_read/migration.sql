-- ---------------------------------------------------------------------------
-- Grant AGENT the relationship.read permission.
-- ---------------------------------------------------------------------------
-- The code side is already complete and committed: the AGENT role carries
-- relationship.read in packages/shared/src/permissions.js, RelationshipService
-- scopes agents to customers they may already see, holders() returns nothing to
-- them, and assign/release stay behind relationship.manage. The only thing
-- missing is the row in the live role_permissions table, which is what this
-- migration adds.
--
-- prisma/seed.js is NOT the tool for this: seedRoles() does
-- rolePermission.deleteMany({ where: { roleId } }) followed by createMany, which
-- rewrites every role's entire permission set from the code matrix and would
-- discard any database-side change. This statement is purely additive.
--
-- Properties:
--   * additive     — one INSERT, no UPDATE / DELETE / DROP / TRUNCATE
--   * idempotent   — ON CONFLICT DO NOTHING against the (role_id, permission_id)
--                    primary key, so re-running changes nothing
--   * targeted     — the WHERE clause matches exactly one role and exactly one
--                    permission, so at most ONE row can be inserted
--   * non-creating — it deliberately does not insert into "permissions". The
--                    relationship.read row already exists (FOUNDER and MANAGER
--                    hold it). If it were somehow absent this inserts 0 rows
--                    rather than inventing a permission; the pre-flight check in
--                    the accompanying report catches that case.
--
-- relationship.manage is deliberately NOT granted: agents must not be able to
-- assign or release relationship ownership.

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" = 'AGENT'
   AND p."code" = 'relationship.read'
ON CONFLICT DO NOTHING;
