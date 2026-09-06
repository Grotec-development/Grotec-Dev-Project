-- PRD v2.1 / developer-brief alignment (Month 1 foundation):
-- 1. Location hierarchy uses "taluk" (PRD §6.3.4, glossary) — renamed from tehsil.
-- 2. Customers gain a unique Farmer ID (developer brief master list) generated from
--    farmer_code_seq as GF<8-digit>; existing rows are backfilled in creation order.
-- 3. preferred_language column reserved (vocabulary is an open item).

-- Rename tehsil -> taluk (keeps data; no drop/recreate).
ALTER TABLE "customer_locations" RENAME COLUMN "tehsil" TO "taluk";

-- Farmer ID support.
CREATE SEQUENCE IF NOT EXISTS "farmer_code_seq" START WITH 1 INCREMENT BY 1;

ALTER TABLE "customers" ADD COLUMN "farmer_code" VARCHAR(20);
ALTER TABLE "customers" ADD COLUMN "preferred_language" VARCHAR(10);

-- Backfill existing customers with unique farmer codes, preserving insertion order.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM "customers" WHERE "farmer_code" IS NULL ORDER BY "created_at", "id"
  LOOP
    UPDATE "customers"
       SET "farmer_code" = 'GF' || LPAD(nextval('farmer_code_seq')::TEXT, 8, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- Matches Prisma's naming convention for @unique fields.
CREATE UNIQUE INDEX "customers_farmer_code_key" ON "customers"("farmer_code");
