-- AI Assistant (replaces the Knowledge Base screen): crop -> problem/symptom ->
-- recommended Grotec product guidance, used as retrieval context for the chat.
-- Founder/Manager curate rows; Agents/telecallers reach them read-only via the chatbot.

CREATE TABLE "crop_product_guidance" (
    "id" UUID NOT NULL,
    "crop_id" UUID NOT NULL,
    "problem_keywords" TEXT[] NOT NULL,
    "recommended_products" TEXT[] NOT NULL,
    "usage_guidance" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crop_product_guidance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crop_product_guidance_crop_id_idx" ON "crop_product_guidance"("crop_id");

ALTER TABLE "crop_product_guidance" ADD CONSTRAINT "crop_product_guidance_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crop_product_guidance" ADD CONSTRAINT "crop_product_guidance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
