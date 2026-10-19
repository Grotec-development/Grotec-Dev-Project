-- AlterTable CustomerLocation
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "location_name" VARCHAR(100);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "custom_name" VARCHAR(100);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "post_office" VARCHAR(100);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "landmark" VARCHAR(200);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "contact_person" VARCHAR(100);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(20);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "verified_by_id" UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_locations_verified_by_id_fkey'
  ) THEN
    ALTER TABLE "customer_locations" ADD CONSTRAINT "customer_locations_verified_by_id_fkey"
      FOREIGN KEY ("verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable Customer
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "relationship_stage" VARCHAR(30) NOT NULL DEFAULT 'PROSPECT';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "hold_until" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "hold_reason" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "client_since" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "conversion_source" VARCHAR(50);

-- AlterTable SalesOrder
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "location_id" UUID;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_requested_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_approved_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_reason" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_status" VARCHAR(30) NOT NULL DEFAULT 'NONE';
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_approved_by_id" UUID;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_approved_at" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "discount_rejection_reason" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_required_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_payment_status" VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_exception_reason" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_exception_approved_by_id" UUID;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_exception_approved_at" TIMESTAMP(3);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_location_id_fkey'
  ) THEN
    ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "customer_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_discount_approved_by_id_fkey'
  ) THEN
    ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_discount_approved_by_id_fkey"
      FOREIGN KEY ("discount_approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_advance_exception_approved_by_id_fkey'
  ) THEN
    ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_advance_exception_approved_by_id_fkey"
      FOREIGN KEY ("advance_exception_approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable Invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable Payments
CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "invoice_id" UUID,
    "order_id" UUID NOT NULL,
    "payment_number" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" VARCHAR(50) NOT NULL,
    "is_advance" BOOLEAN NOT NULL DEFAULT false,
    "reference_number" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_number_key" ON "payments"("payment_number");
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id");

-- AlterTable DeliveryRoute
ALTER TABLE "delivery_routes" ADD COLUMN IF NOT EXISTS "schedule_days" TEXT[] NOT NULL DEFAULT '{}';
