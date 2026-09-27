-- ---------------------------------------------------------------------------
-- Record the two Employee columns that were added to schema.prisma without a
-- migration (blood_group, aadhaar_number).
-- ---------------------------------------------------------------------------
-- Production already has both columns (applied out of band), so this is a
-- no-op there; a database built from migrations alone (staging, disaster
-- recovery, a new tenant) would otherwise fail on every employee read.
--
-- Properties: additive and idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "blood_group" VARCHAR(10);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "aadhaar_number" VARCHAR(20);
