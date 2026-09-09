-- Customer referrals (Step 3B).
-- Migration ID: 20260909003000
--
-- An append-only record that an existing customer referred a new lead. The
-- referred customer is NOT stored here: it is derived through lead.customer_id,
-- so the two can never disagree. No soft delete and no update path — referral
-- history is immutable, matching lead_ownership / relationship_ownership.
--
-- The unique constraint is what actually protects against duplicates: two
-- concurrent requests cannot both insert (same referrer, same lead). Different
-- referrers MAY refer the same lead.

CREATE TABLE IF NOT EXISTS "referrals" (
  "id"                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrer_customer_id" UUID        NOT NULL,
  "lead_id"              UUID        NOT NULL,
  "notes"                TEXT,
  "created_by"           UUID        NOT NULL,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Names match Prisma's conventions so `migrate deploy` and `db push` agree.
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_customer_id_fkey"
    FOREIGN KEY ("referrer_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Duplicate protection: one referral per (referrer, lead).
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referrer_customer_id_lead_id_key"
  ON "referrals" ("referrer_customer_id", "lead_id");

CREATE INDEX IF NOT EXISTS "referrals_referrer_customer_id_idx" ON "referrals" ("referrer_customer_id");
CREATE INDEX IF NOT EXISTS "referrals_lead_id_idx"              ON "referrals" ("lead_id");

-- ---------------------------------------------------------------------------
-- Referral permissions, installed additively.
-- ---------------------------------------------------------------------------
-- prisma/seed.js rebuilds the whole role matrix (rolePermission.deleteMany then
-- createMany) and must never run against the application database. These
-- statements are purely additive and idempotent: they insert the two permission
-- rows and link them to FOUNDER, MANAGER and AGENT only. Nothing is deleted, no
-- existing permission or role link is altered, and re-running is a no-op.
-- STAFF and DELIVERY deliberately receive neither.

INSERT INTO "permissions" ("id", "code", "module", "description", "created_at")
VALUES
  (gen_random_uuid(), 'referral.read',   'referral', 'Permission referral.read',   now()),
  (gen_random_uuid(), 'referral.manage', 'referral', 'Permission referral.manage', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
 CROSS JOIN "permissions" p
 WHERE r."code" IN ('FOUNDER', 'MANAGER', 'AGENT')
   AND p."code" IN ('referral.read', 'referral.manage')
ON CONFLICT DO NOTHING;
