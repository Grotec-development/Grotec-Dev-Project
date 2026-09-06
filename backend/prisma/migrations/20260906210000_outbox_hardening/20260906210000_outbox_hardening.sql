-- Checkpoint E Hardening: Consumer idempotency + lease-based recovery.
-- Migration ID: 20260906210000
-- Run after: 20260906200000_outbox_event_table
--
-- Contents:
--   1. lease_expires_at column on outbox_events — enables stale PROCESSING recovery
--   2. processed_events table — consumer-side idempotency (eventId × consumerName)
--   3. Updated index on outbox_events for lease-aware claiming

-- 1. Add lease_expires_at to outbox_events (safe for repeat runs)
DO $$ BEGIN
  ALTER TABLE "outbox_events" ADD COLUMN "lease_expires_at" TIMESTAMPTZ;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 1b. Add event_id column (application-level event UUID, distinct from row id).
-- This column is required for consumer-side idempotency (ProcessedEvent.eventId references it).
DO $$ BEGIN
  ALTER TABLE "outbox_events" ADD COLUMN "event_id" UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- event_id must be unique so it can be referenced by ProcessedEvent
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_event_id_idx"
  ON "outbox_events" ("event_id");

-- Updated composite index: also filter out live leases in worker query.
-- The old index (status, next_retry_at) is replaced by:
CREATE INDEX IF NOT EXISTS "outbox_events_status_next_retry_lease_idx"
  ON "outbox_events" ("status", "next_retry_at", "lease_expires_at");

-- 2. Consumer idempotency table.
CREATE TABLE IF NOT EXISTS "processed_events" (
  "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotency_key"  VARCHAR(120) NOT NULL,
  "event_id"         UUID         NOT NULL,
  "consumer_name"    VARCHAR(60)  NOT NULL,
  "processed_at"      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Unique constraint: one processed record per (eventId, consumerName).
-- This is the authoritative consumer-side idempotency guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS "processed_events_consumer_idem_idx"
  ON "processed_events" ("event_id", "consumer_name");

-- Fast lookup by eventId.
CREATE INDEX IF NOT EXISTS "processed_events_event_id_idx"
  ON "processed_events" ("event_id");
