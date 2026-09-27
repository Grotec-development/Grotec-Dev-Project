-- ---------------------------------------------------------------------------
-- Action Center employee requests (manager note, HR inquiry, office resource,
-- issue report). These previously lived only in the browser's localStorage.
-- ---------------------------------------------------------------------------
-- New types and tables only; the two NotificationType values are appended.

CREATE TYPE "EmployeeRequestType" AS ENUM ('MANAGER_NOTE', 'HR_INQUIRY', 'OFFICE_RESOURCE', 'ISSUE_REPORT');

CREATE TYPE "EmployeeRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMPLOYEE_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMPLOYEE_REQUEST_UPDATED';

CREATE TABLE "employee_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "requester_id" UUID NOT NULL,
    "assignee_id" UUID,
    "type" "EmployeeRequestType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "EmployeeRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_request_history" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_request_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_requests_requester_id_created_at_idx" ON "employee_requests"("requester_id", "created_at");

CREATE INDEX "employee_requests_assignee_id_status_idx" ON "employee_requests"("assignee_id", "status");

CREATE INDEX "employee_requests_status_created_at_idx" ON "employee_requests"("status", "created_at");

CREATE INDEX "employee_request_history_request_id_idx" ON "employee_request_history"("request_id");

ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_request_history" ADD CONSTRAINT "employee_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "employee_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
