-- Checkpoint E: Transactional outbox.
-- Migration ID: 20260906200000
--
-- Adds the outbox_event table for reliable event delivery:
--   - Domain mutations write events atomically into the outbox (same transaction).
--   - OutboxWorker processes PENDING events asynchronously with safe claiming.
--   - idempotency_key prevents duplicate event emission.
--   - retry fields (attempts, nextRetryAt, lastError) enable safe retry.

-- Create the enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Outbox event store: appended inside the same transaction as the domain mutation,
-- consumed asynchronously by OutboxWorker.
CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id"              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotency_key" VARCHAR(120) UNIQUE,
  "event_type"      VARCHAR(60)  NOT NULL,
  "aggregate_type"  VARCHAR(60)  NOT NULL,
  "aggregate_id"    UUID         NOT NULL,
  "payload"         JSONB        NOT NULL DEFAULT '{}',
  "status"          "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"        INT          NOT NULL DEFAULT 0,
  "max_attempts"    INT          NOT NULL DEFAULT 3,
  "last_error"      TEXT,
  "next_retry_at"   TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "processed_at"     TIMESTAMPTZ
);

-- Fast claim of pending events for the worker.
CREATE INDEX IF NOT EXISTS "outbox_events_status_next_retry_at_idx"
  ON "outbox_events" ("status", "next_retry_at");

-- Idempotent lookup by aggregate (useful for projections).
CREATE INDEX IF NOT EXISTS "outbox_events_aggregate_idx"
  ON "outbox_events" ("aggregate_type", "aggregate_id");

-- Order events for audit/replay.
CREATE INDEX IF NOT EXISTS "outbox_events_created_at_idx"
  ON "outbox_events" ("created_at");
