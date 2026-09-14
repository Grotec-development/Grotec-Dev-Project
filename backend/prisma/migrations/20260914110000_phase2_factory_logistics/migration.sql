-- Phase 2: Factory, Supply Chain, Logistics & Delivery (PRD §18)

-- 1. CreateTable: product_categories
CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_categories_code_key" UNIQUE ("code"),
    CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 2. CreateTable: products
CREATE TABLE IF NOT EXISTS "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "category_id" UUID,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(100) NOT NULL DEFAULT 'Grotec',
    "description" TEXT,
    "hsn_code" VARCHAR(20) DEFAULT '31010099',
    "unit" VARCHAR(20) NOT NULL DEFAULT 'LTR',
    "package_size" DECIMAL(10,2) NOT NULL DEFAULT 1.0,
    "base_price" DECIMAL(12,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_sku_key" UNIQUE ("sku"),
    CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products"("name");
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");

-- 3. CreateTable: production_batches
CREATE TABLE IF NOT EXISTS "production_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "batch_number" VARCHAR(60) NOT NULL,
    "product_id" UUID NOT NULL,
    "mfg_date" TIMESTAMP(3) NOT NULL,
    "exp_date" TIMESTAMP(3) NOT NULL,
    "quantity_produced" DECIMAL(12,2) NOT NULL,
    "quantity_remaining" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "production_batches_batch_number_key" UNIQUE ("batch_number"),
    CONSTRAINT "production_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "production_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "production_batches_product_id_idx" ON "production_batches"("product_id");

-- 4. CreateTable: inventory_stocks
CREATE TABLE IF NOT EXISTS "inventory_stocks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "product_id" UUID NOT NULL,
    "batch_id" UUID,
    "state" VARCHAR(30) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "location" VARCHAR(100) NOT NULL DEFAULT 'CENTRAL_WAREHOUSE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_stocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_stocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stocks_product_id_batch_id_state_location_key" 
ON "inventory_stocks"("product_id", "batch_id", "state", "location");
CREATE INDEX IF NOT EXISTS "inventory_stocks_product_id_state_idx" ON "inventory_stocks"("product_id", "state");

-- 5. CreateTable: inventory_movements
CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" UUID NOT NULL,
    "stock_id" UUID,
    "product_id" UUID NOT NULL,
    "from_state" VARCHAR(30),
    "to_state" VARCHAR(30) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(100),
    "actor_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "inventory_stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_movements_product_id_idx" ON "inventory_movements"("product_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");

-- 6. CreateTable: sales_orders
CREATE TABLE IF NOT EXISTS "sales_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "order_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "payment_status" VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
    "payment_method" VARCHAR(50),
    "delivery_address" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_orders_order_number_key" UNIQUE ("order_number"),
    CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX IF NOT EXISTS "sales_orders_status_idx" ON "sales_orders"("status");

-- 7. CreateTable: sales_order_items
CREATE TABLE IF NOT EXISTS "sales_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "original_qty" DECIMAL(12,2) NOT NULL,
    "approved_qty" DECIMAL(12,2) NOT NULL,
    "delivered_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sales_order_items_order_id_idx" ON "sales_order_items"("order_id");
CREATE INDEX IF NOT EXISTS "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- 8. CreateTable: invoices
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    "is_revised" BOOLEAN NOT NULL DEFAULT false,
    "revision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoices_order_id_key" UNIQUE ("order_id"),
    CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number"),
    CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 9. CreateTable: vehicles
CREATE TABLE IF NOT EXISTS "vehicles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "reg_number" VARCHAR(30) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "capacity_kg" DECIMAL(10,2) NOT NULL DEFAULT 2500,
    "driver_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicles_reg_number_key" UNIQUE ("reg_number"),
    CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 10. CreateTable: trips
CREATE TABLE IF NOT EXISTS "trips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "trip_number" VARCHAR(50) NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "helper_name" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "start_odometer" DECIMAL(10,2),
    "end_odometer" DECIMAL(10,2),
    "departure_time" TIMESTAMP(3),
    "return_time" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trips_trip_number_key" UNIQUE ("trip_number"),
    CONSTRAINT "trips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "trips_vehicle_id_idx" ON "trips"("vehicle_id");
CREATE INDEX IF NOT EXISTS "trips_driver_id_idx" ON "trips"("driver_id");
CREATE INDEX IF NOT EXISTS "trips_status_idx" ON "trips"("status");

-- 11. CreateTable: trip_stops
CREATE TABLE IF NOT EXISTS "trip_stops" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    "arrived_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "signature_url" TEXT,
    "photo_url" TEXT,
    "pod_notes" TEXT,
    "failure_reason" TEXT,
    "gps_latitude" DECIMAL(10,7),
    "gps_longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trip_stops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "trip_stops_trip_id_idx" ON "trip_stops"("trip_id");
CREATE INDEX IF NOT EXISTS "trip_stops_order_id_idx" ON "trip_stops"("order_id");

-- 12. CreateTable: quantity_exceptions
CREATE TABLE IF NOT EXISTS "quantity_exceptions" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "original_qty" DECIMAL(12,2) NOT NULL,
    "requested_qty" DECIMAL(12,2) NOT NULL,
    "approved_qty" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "photo_url" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    "reviewed_by" UUID,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quantity_exceptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quantity_exceptions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quantity_exceptions_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quantity_exceptions_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quantity_exceptions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "quantity_exceptions_trip_id_idx" ON "quantity_exceptions"("trip_id");
CREATE INDEX IF NOT EXISTS "quantity_exceptions_stop_id_idx" ON "quantity_exceptions"("stop_id");
CREATE INDEX IF NOT EXISTS "quantity_exceptions_status_idx" ON "quantity_exceptions"("status");

-- 13. CreateTable: vehicle_stocks
CREATE TABLE IF NOT EXISTS "vehicle_stocks" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "loaded_qty" DECIMAL(12,2) NOT NULL,
    "delivered_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "excess_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reallocated_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returned_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_stocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_stocks_trip_id_product_id_key" UNIQUE ("trip_id", "product_id"),
    CONSTRAINT "vehicle_stocks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicle_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "vehicle_stocks_trip_id_idx" ON "vehicle_stocks"("trip_id");
