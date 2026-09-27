-- ---------------------------------------------------------------------------
-- Assign customers and employees created without a tenant to the tenant.
-- ---------------------------------------------------------------------------
-- Customer creation and employee creation never set tenant_id, so a handful of
-- UI-created rows are tenant-less while imported rows carry the default
-- "grotec" tenant. Customer reads are now filtered by the caller's tenant, so
-- these rows must belong to one.
--
-- Guarded to run only while exactly one tenant exists: with several tenants
-- the right owner of a null row is a business decision, not a default.
--
-- Properties: touches only rows whose tenant_id IS NULL; idempotent.

UPDATE "customers"
   SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1)
 WHERE "tenant_id" IS NULL
   AND (SELECT COUNT(*) FROM "tenants") = 1;

UPDATE "employees"
   SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1)
 WHERE "tenant_id" IS NULL
   AND (SELECT COUNT(*) FROM "tenants") = 1;
