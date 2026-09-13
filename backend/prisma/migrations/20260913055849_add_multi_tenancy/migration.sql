-- DropIndex if exists
DROP INDEX IF EXISTS "outbox_events_status_next_retry_at_idx";
DROP INDEX IF EXISTS "processed_events_event_id_idx";

-- AlterTable additions (idempotent)
ALTER TABLE "advance_recoveries" ADD COLUMN IF NOT EXISTS "linked_payroll_month" VARCHAR(7);

ALTER TABLE "attendance_records" 
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "exception_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "has_exception" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "source_essl_punch_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "crops" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

ALTER TABLE "employee_documents" 
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS "uploaded_by_id" UUID;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "follow_ups" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "kpi_targets" ADD COLUMN IF NOT EXISTS "team_id" VARCHAR(100);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

-- CreateTable: tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'ENTERPRISE',
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_notes
CREATE TABLE IF NOT EXISTS "employee_notes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_assignments
CREATE TABLE IF NOT EXISTS "employee_assignments" (
    "id" UUID NOT NULL,
    "staff_employee_id" UUID NOT NULL,
    "assigned_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: essl_punches
CREATE TABLE IF NOT EXISTS "essl_punches" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "device_id" VARCHAR(50) NOT NULL,
    "external_biometric_id" VARCHAR(50),
    "punch_at" TIMESTAMP(3) NOT NULL,
    "punch_type" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    "raw_payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,

    CONSTRAINT "essl_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_components
CREATE TABLE IF NOT EXISTS "salary_components" (
    "id" UUID NOT NULL,
    "salary_revision_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kpi_metric_definitions
CREATE TABLE IF NOT EXISTS "kpi_metric_definitions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kpi_scores
CREATE TABLE IF NOT EXISTS "kpi_scores" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "metric_code" VARCHAR(50) NOT NULL,
    "actual_value" DECIMAL(12,2) NOT NULL,
    "target_value" DECIMAL(12,2) NOT NULL,
    "achievement_percent" DECIMAL(6,2) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kpi_review_entries
CREATE TABLE IF NOT EXISTS "kpi_review_entries" (
    "id" UUID NOT NULL,
    "kpi_period_score_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_review_entries_pkey" PRIMARY KEY ("id")
);

-- Create Indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "employee_notes_employee_id_idx" ON "employee_notes"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_assignments_staff_employee_id_assigned_employee_id_key" ON "employee_assignments"("staff_employee_id", "assigned_employee_id");
CREATE INDEX IF NOT EXISTS "essl_punches_employee_id_punch_at_idx" ON "essl_punches"("employee_id", "punch_at");
CREATE INDEX IF NOT EXISTS "essl_punches_processed_at_idx" ON "essl_punches"("processed_at");
CREATE INDEX IF NOT EXISTS "essl_punches_device_id_punch_at_idx" ON "essl_punches"("device_id", "punch_at");
CREATE UNIQUE INDEX IF NOT EXISTS "essl_punches_device_id_external_biometric_id_punch_at_key" ON "essl_punches"("device_id", "external_biometric_id", "punch_at");
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_metric_definitions_code_key" ON "kpi_metric_definitions"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_scores_employee_id_period_metric_code_key" ON "kpi_scores"("employee_id", "period", "metric_code");
CREATE INDEX IF NOT EXISTS "kpi_review_entries_kpi_period_score_id_idx" ON "kpi_review_entries"("kpi_period_score_id");
CREATE INDEX IF NOT EXISTS "processed_events_idempotency_key_idx" ON "processed_events"("idempotency_key");

-- Add Foreign Keys (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tenant_id_fkey') THEN
        ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_tenant_id_fkey') THEN
        ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crops_tenant_id_fkey') THEN
        ALTER TABLE "crops" ADD CONSTRAINT "crops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_tenant_id_fkey') THEN
        ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calls_tenant_id_fkey') THEN
        ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_uploaded_by_id_fkey') THEN
        ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_notes_employee_id_fkey') THEN
        ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_notes_author_id_fkey') THEN
        ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_staff_employee_id_fkey') THEN
        ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_staff_employee_id_fkey" FOREIGN KEY ("staff_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_assigned_employee_id_fkey') THEN
        ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_components_salary_revision_id_fkey') THEN
        ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_salary_revision_id_fkey" FOREIGN KEY ("salary_revision_id") REFERENCES "salary_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_review_entries_kpi_period_score_id_fkey') THEN
        ALTER TABLE "kpi_review_entries" ADD CONSTRAINT "kpi_review_entries_kpi_period_score_id_fkey" FOREIGN KEY ("kpi_period_score_id") REFERENCES "kpi_period_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Rename indexes safely if old names exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'outbox_events_aggregate_idx') THEN
        ALTER INDEX "outbox_events_aggregate_idx" RENAME TO "outbox_events_aggregate_type_aggregate_id_idx";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'outbox_events_event_id_idx') THEN
        ALTER INDEX "outbox_events_event_id_idx" RENAME TO "outbox_events_event_id_key";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'outbox_events_status_next_retry_lease_idx') THEN
        ALTER INDEX "outbox_events_status_next_retry_lease_idx" RENAME TO "outbox_events_status_next_retry_at_lease_expires_at_idx";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'processed_events_consumer_idem_idx') THEN
        ALTER INDEX "processed_events_consumer_idem_idx" RENAME TO "processed_events_event_id_consumer_name_key";
    END IF;
END $$;
