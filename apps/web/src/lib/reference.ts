/**
 * PRD §6.5.2 content taxonomy used by the Crops catalog and the Knowledge Base.
 * Values are stored as these codes (configurable vocabulary, PRD §13); these
 * maps render them. Mirrors the API-side lists in the crops/assistant DTOs.
 */
import {
  CROP_CATEGORIES,
  type CropCategory,
  PROBLEM_TYPES,
  type ProblemType,
} from '@grotec/shared';

export { CROP_CATEGORIES, type CropCategory, PROBLEM_TYPES, type ProblemType };

export const CROP_CATEGORY_LABELS: Record<CropCategory, string> = {
  FIELD: 'Field crop',
  TREE: 'Tree crop',
  PLANTATION: 'Plantation crop',
  VEGETABLE: 'Vegetable crop',
  OTHER: 'Other',
};

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  PEST: 'Pest attack',
  DISEASE: 'Disease',
  NUTRIENT_DEFICIENCY: 'Nutrient deficiency',
  WEED: 'Weeds',
  OTHER: 'Other issue',
};

/** Pill classes per problem type for the Knowledge Base cards/filter chips. */
export const PROBLEM_TYPE_TONES: Record<ProblemType, { label: string; cls: string }> = {
  PEST: { label: PROBLEM_TYPE_LABELS.PEST, cls: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
  DISEASE: { label: PROBLEM_TYPE_LABELS.DISEASE, cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  NUTRIENT_DEFICIENCY: { label: PROBLEM_TYPE_LABELS.NUTRIENT_DEFICIENCY, cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  WEED: { label: PROBLEM_TYPE_LABELS.WEED, cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  OTHER: { label: PROBLEM_TYPE_LABELS.OTHER, cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

export function isProblemType(value: string | null | undefined): value is ProblemType {
  return Boolean(value && (PROBLEM_TYPES as readonly string[]).includes(value));
}
