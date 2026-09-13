/*
  Warnings:

  - Made the column `event_id` on table `outbox_events` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "outbox_events_status_next_retry_at_idx";

-- DropIndex
DROP INDEX "processed_events_event_id_idx";

-- AlterTable
ALTER TABLE "advance_recoveries" ADD COLUMN     "linked_payroll_month" VARCHAR(7);

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "exception_type" VARCHAR(50),
ADD COLUMN     "has_exception" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_essl_punch_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "crops" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "employee_documents" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
ADD COLUMN     "uploaded_by_id" UUID,
ALTER COLUMN "file_type" SET DEFAULT 'application/pdf',
ALTER COLUMN "file_size" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "follow_ups" ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "kpi_targets" ADD COLUMN     "team_id" VARCHAR(100);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "payload" DROP DEFAULT,
ALTER COLUMN "next_retry_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "processed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lease_expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "event_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "processed_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "processed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "referrals" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'ENTERPRISE',
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_notes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" UUID NOT NULL,
    "staff_employee_id" UUID NOT NULL,
    "assigned_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essl_punches" (
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

-- CreateTable
CREATE TABLE "salary_components" (
    "id" UUID NOT NULL,
    "salary_revision_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_metric_definitions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_scores" (
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

-- CreateTable
CREATE TABLE "kpi_review_entries" (
    "id" UUID NOT NULL,
    "kpi_period_score_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_review_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "employee_notes_employee_id_idx" ON "employee_notes"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_assignments_staff_employee_id_assigned_employee_id_key" ON "employee_assignments"("staff_employee_id", "assigned_employee_id");

-- CreateIndex
CREATE INDEX "essl_punches_employee_id_punch_at_idx" ON "essl_punches"("employee_id", "punch_at");

-- CreateIndex
CREATE INDEX "essl_punches_processed_at_idx" ON "essl_punches"("processed_at");

-- CreateIndex
CREATE INDEX "essl_punches_device_id_punch_at_idx" ON "essl_punches"("device_id", "punch_at");

-- CreateIndex
CREATE UNIQUE INDEX "essl_punches_device_id_external_biometric_id_punch_at_key" ON "essl_punches"("device_id", "external_biometric_id", "punch_at");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_metric_definitions_code_key" ON "kpi_metric_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_scores_employee_id_period_metric_code_key" ON "kpi_scores"("employee_id", "period", "metric_code");

-- CreateIndex
CREATE INDEX "kpi_review_entries_kpi_period_score_id_idx" ON "kpi_review_entries"("kpi_period_score_id");

-- CreateIndex
CREATE INDEX "processed_events_idempotency_key_idx" ON "processed_events"("idempotency_key");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_staff_employee_id_fkey" FOREIGN KEY ("staff_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_salary_revision_id_fkey" FOREIGN KEY ("salary_revision_id") REFERENCES "salary_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_review_entries" ADD CONSTRAINT "kpi_review_entries_kpi_period_score_id_fkey" FOREIGN KEY ("kpi_period_score_id") REFERENCES "kpi_period_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "outbox_events_aggregate_idx" RENAME TO "outbox_events_aggregate_type_aggregate_id_idx";

-- RenameIndex
ALTER INDEX "outbox_events_event_id_idx" RENAME TO "outbox_events_event_id_key";

-- RenameIndex
ALTER INDEX "outbox_events_status_next_retry_lease_idx" RENAME TO "outbox_events_status_next_retry_at_lease_expires_at_idx";

-- RenameIndex
ALTER INDEX "processed_events_consumer_idem_idx" RENAME TO "processed_events_event_id_consumer_name_key";
