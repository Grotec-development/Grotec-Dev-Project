import { PAGINATION } from '@grotec/shared';
import { ApiError } from '../errors/api-error';

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(pageRaw?: string | number, sizeRaw?: string | number): PageParams {
  const page = clampInt(pageRaw, PAGINATION.DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampInt(sizeRaw, PAGINATION.DEFAULT_PAGE_SIZE, 1, PAGINATION.MAX_PAGE_SIZE);
  if (Number.isNaN(page) || Number.isNaN(pageSize)) {
    throw ApiError.badRequest('INVALID_PAGINATION', 'Invalid page or pageSize');
  }
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function clampInt(raw: string | number | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isInteger(value)) return NaN;
  return Math.min(max, Math.max(min, value));
}

export function toPage<T>(items: T[], total: number, { page, pageSize }: PageParams) {
  return { items, total, page, pageSize };
}
