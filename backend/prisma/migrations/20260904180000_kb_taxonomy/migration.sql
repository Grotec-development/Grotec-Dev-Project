-- PRD §6.5.2 / §11 content structure: Crop gains a category (field / tree /
-- plantation / vegetable / other) and each crop-product guidance row gains the
-- problem/issue type taxonomy (pest / disease / nutrient deficiency / weed /
-- other) so the Knowledge Base can filter and present crop -> problem type ->
-- solution. Both are nullable VARCHAR so the vocabulary stays configurable
-- (PRD §13 configurability; no enum lock-in) - the UI presents the fixed
-- GROTEC starter vocabulary.

ALTER TABLE "crops" ADD COLUMN "category" VARCHAR(40);
ALTER TABLE "crop_product_guidance" ADD COLUMN "problem_type" VARCHAR(40);
CREATE INDEX "crop_product_guidance_problem_type_idx" ON "crop_product_guidance"("problem_type");
