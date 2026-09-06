-- Month 3: call outcomes + next actions (separate fields, PRD §6.3.6/§11.1),
-- follow-ups (PRD §11), relationship ownership (PRD §6.4) and the outbound
-- message log for automatic product communication (§6.3.10). Customer notes
-- arrive with the Month 4 RM workspace.

CREATE TYPE "CallOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'NOT_ANSWERED');
CREATE TYPE "NextAction" AS ENUM ('CALLBACK', 'SALES');
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "MessageType" AS ENUM ('PRODUCT_DETAILS');

-- Outcome + next action live on the call as separate columns (never merged).
ALTER TABLE "calls" ADD COLUMN "outcome" "CallOutcome";
ALTER TABLE "calls" ADD COLUMN "next_action" "NextAction";
CREATE INDEX "calls_outcome_idx" ON "calls"("outcome");

CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "call_id" UUID,
    "lead_id" UUID,
    "agent_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "follow_ups_agent_id_due_at_idx" ON "follow_ups"("agent_id", "due_at");
CREATE INDEX "follow_ups_customer_id_due_at_idx" ON "follow_ups"("customer_id", "due_at");
CREATE INDEX "follow_ups_status_due_at_idx" ON "follow_ups"("status", "due_at");
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "relationship_ownership" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "reason" TEXT,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ,
    CONSTRAINT "relationship_ownership_pkey" PRIMARY KEY ("id")
);
-- One CURRENT RM per customer (partial unique index over active rows).
CREATE UNIQUE INDEX "relationship_ownership_active_customer_key" ON "relationship_ownership"("customer_id") WHERE "released_at" IS NULL;
CREATE INDEX "relationship_ownership_employee_id_idx" ON "relationship_ownership"("employee_id");
ALTER TABLE "relationship_ownership" ADD CONSTRAINT "relationship_ownership_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relationship_ownership" ADD CONSTRAINT "relationship_ownership_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relationship_ownership" ADD CONSTRAINT "relationship_ownership_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "call_id" UUID,
    "type" "MessageType" NOT NULL DEFAULT 'PRODUCT_DETAILS',
    "provider" VARCHAR(40) NOT NULL,
    "provider_message_id" VARCHAR(120),
    "recipient_phone" VARCHAR(20) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "error" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbound_messages_customer_id_idx" ON "outbound_messages"("customer_id");
CREATE INDEX "outbound_messages_status_idx" ON "outbound_messages"("status");
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer notes (Month 4 RM workspace).
CREATE TABLE "customer_notes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
