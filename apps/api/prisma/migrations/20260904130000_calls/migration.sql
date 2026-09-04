-- Month 2: Agent calling workspace (PRD §6.3).
-- Canonical call states (PRD §6.3.3) — final list is provider-dependent (open
-- item), these are the canonical states providers map onto.
CREATE TYPE "CallStatus" AS ENUM ('DIALING', 'RINGING', 'CONNECTED', 'ENDED', 'NOT_ANSWERED', 'FAILED');
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND');

CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "lead_id" UUID,
    "agent_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "status" "CallStatus" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "provider_call_id" VARCHAR(120) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connected_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "disconnect_reason" VARCHAR(40),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calls_provider_call_id_key" ON "calls"("provider_call_id");
CREATE INDEX "calls_agent_id_started_at_idx" ON "calls"("agent_id", "started_at");
CREATE INDEX "calls_customer_id_started_at_idx" ON "calls"("customer_id", "started_at");
CREATE INDEX "calls_lead_id_idx" ON "calls"("lead_id");
CREATE INDEX "calls_phone_number_idx" ON "calls"("phone_number");
CREATE INDEX "calls_status_idx" ON "calls"("status");

ALTER TABLE "calls" ADD CONSTRAINT "calls_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "call_notes" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_notes_call_id_idx" ON "call_notes"("call_id");

ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;