-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'REOPENED');

-- AlterTable Crop
ALTER TABLE "crops" ADD COLUMN IF NOT EXISTS "scientific_name" VARCHAR(120);
ALTER TABLE "crops" ADD COLUMN IF NOT EXISTS "duration_days" INTEGER;
ALTER TABLE "crops" ADD COLUMN IF NOT EXISTS "classification" VARCHAR(40);

-- AlterTable CustomerCrop
ALTER TABLE "customer_crops" ADD COLUMN IF NOT EXISTS "sowing_date" DATE;
ALTER TABLE "customer_crops" ADD COLUMN IF NOT EXISTS "harvest_date" DATE;
ALTER TABLE "customer_crops" ADD COLUMN IF NOT EXISTS "crop_stage" VARCHAR(60);
ALTER TABLE "customer_crops" ADD COLUMN IF NOT EXISTS "season" VARCHAR(50);
ALTER TABLE "customer_crops" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable SalesOrder
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "route_id" UUID;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "requested_delivery_date" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "confirmed_delivery_date" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "delivery_confirmation_status" VARCHAR(50);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "confirmation_notes" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

-- CreateTable SoilType
CREATE TABLE IF NOT EXISTS "soil_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_ta" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soil_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "soil_types_code_key" ON "soil_types"("code");

-- CreateTable SupportTicket
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "ticket_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "call_id" UUID,
    "category" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_role" VARCHAR(50),
    "assignee_id" UUID,
    "created_by_id" UUID,
    "due_date" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "support_tickets_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "support_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "support_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");
CREATE INDEX IF NOT EXISTS "support_tickets_customer_id_idx" ON "support_tickets"("customer_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "support_tickets_assignee_id_idx" ON "support_tickets"("assignee_id");
CREATE INDEX IF NOT EXISTS "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateTable SupportTicketHistory
CREATE TABLE IF NOT EXISTS "support_ticket_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "support_ticket_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "support_ticket_history_ticket_id_idx" ON "support_ticket_history"("ticket_id");

-- CreateTable DeliveryRoute
CREATE TABLE IF NOT EXISTS "delivery_routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_routes_code_key" ON "delivery_routes"("code");

-- CreateTable RouteDistrict
CREATE TABLE IF NOT EXISTS "route_districts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "towns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_districts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "route_districts_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "route_districts_route_id_district_key" ON "route_districts"("route_id", "district");
CREATE INDEX IF NOT EXISTS "route_districts_district_idx" ON "route_districts"("district");

-- AddForeignKey to SalesOrder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_route_id_fkey'
    ) THEN
        ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
