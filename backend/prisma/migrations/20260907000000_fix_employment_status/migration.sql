-- Add missing EmployeeEmploymentStatus enum and employment_status column to employees table.
-- This column was added to schema.prisma but the migration was never created/applied.

-- Create the missing enum
CREATE TYPE "EmployeeEmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED');

-- Add the column with a default so existing rows remain valid
ALTER TABLE "employees" ADD COLUMN "employment_status" "EmployeeEmploymentStatus" DEFAULT 'ACTIVE';
