-- Adds a free-text soil type to the farmer master (owner requirement Q9:
-- "Can farmer details such as land, soil type, and crops be stored?").
--
-- Deliberately a nullable VARCHAR rather than an enum: no soil vocabulary has
-- been approved by GROTEC, so the column stays configurable and the UI presents
-- a plain text input. This follows the precedent set by customers.preferred_language
-- in 20260904120000_prd_alignment, and by crops.category / crop_product_guidance.problem_type
-- in 20260904180000_kb_taxonomy ("nullable VARCHAR so the vocabulary stays
-- configurable ... no enum lock-in").
--
-- Purely additive: no default, no backfill, no index, no constraint. Existing
-- rows receive NULL. Reversible with:
--   ALTER TABLE "customers" DROP COLUMN "soil_type";

ALTER TABLE "customers" ADD COLUMN "soil_type" VARCHAR(40);
