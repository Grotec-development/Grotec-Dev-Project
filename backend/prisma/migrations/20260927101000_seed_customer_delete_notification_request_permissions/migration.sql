-- ---------------------------------------------------------------------------
-- Seed permissions defined in packages/shared/src/permissions.js that the live
-- "permissions" table does not hold, and grant them per the role matrix.
-- ---------------------------------------------------------------------------
-- customer.delete was never seeded (the table had 65 rows against 66 codes),
-- which stayed invisible because PermissionGuard exempted FOUNDER and
-- SUPER_ADMIN from every check. With that exemption removed, the top roles
-- need the row granted like any other permission. The four notification /
-- request permissions are new in this release.
--
-- Business roles (FARMER_SUCCESS_MANAGER, GROUP_LEADER, FSE, ...) inherit the
-- grants of their technical role (see GROTEC_BUSINESS_ROLES).
--
-- prisma/seed.js is NOT used: seedRoles() deletes and recreates each role's
-- whole permission set, which would discard database-side changes.
--
-- Properties: additive (INSERT only) and idempotent (ON CONFLICT DO NOTHING).

INSERT INTO "permissions" ("id", "code", "module", "description", "created_at")
VALUES
  (gen_random_uuid(), 'customer.delete',     'customer',     'Permission customer.delete',     CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notification.read',   'notification', 'Permission notification.read',   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notification.manage', 'notification', 'Permission notification.manage', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'request.create',      'request',      'Permission request.create',      CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'request.manage',      'request',      'Permission request.manage',      CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Top tier and manager-level roles
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" IN ('SUPER_ADMIN', 'FOUNDER', 'MANAGER', 'FARMER_SUCCESS_MANAGER', 'GROUP_LEADER')
   AND p."code" IN ('customer.delete', 'notification.read', 'notification.manage', 'request.create', 'request.manage')
ON CONFLICT DO NOTHING;

-- Every role reads its own notifications and can raise Action Center requests
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE p."code" IN ('notification.read', 'request.create')
ON CONFLICT DO NOTHING;
