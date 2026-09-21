-- AlterTable: calls
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "outcome_custom" VARCHAR(50);
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "product_interest" VARCHAR(200);
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "crop_interest" VARCHAR(200);
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "expected_booking_amount" DECIMAL(12, 2);
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "call_mode" VARCHAR(40);

-- CreateTable: call_outcome_masters
CREATE TABLE IF NOT EXISTS "call_outcome_masters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "reporting_mapping" VARCHAR(50),
    "requires_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "requires_next_action" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_outcome_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable: farmer_segments
CREATE TABLE IF NOT EXISTS "farmer_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "filter_criteria" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "call_outcome_masters_code_key" ON "call_outcome_masters"("code");
CREATE INDEX IF NOT EXISTS "call_outcome_masters_category_idx" ON "call_outcome_masters"("category");
CREATE INDEX IF NOT EXISTS "call_outcome_masters_is_active_idx" ON "call_outcome_masters"("is_active");
CREATE INDEX IF NOT EXISTS "farmer_segments_name_idx" ON "farmer_segments"("name");

-- AddForeignKeys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_outcome_masters_tenant_id_fkey') THEN
        ALTER TABLE "call_outcome_masters" ADD CONSTRAINT "call_outcome_masters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farmer_segments_tenant_id_fkey') THEN
        ALTER TABLE "farmer_segments" ADD CONSTRAINT "farmer_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farmer_segments_created_by_fkey') THEN
        ALTER TABLE "farmer_segments" ADD CONSTRAINT "farmer_segments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
