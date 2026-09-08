import { PAGINATION } from '@grotec/shared';
import { ApiError } from '../errors/api-error';
export function parsePagination(pageRaw, sizeRaw) {
    const page = clampInt(pageRaw, PAGINATION.DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampInt(sizeRaw, PAGINATION.DEFAULT_PAGE_SIZE, 1, PAGINATION.MAX_PAGE_SIZE);
    if (Number.isNaN(page) || Number.isNaN(pageSize)) {
        throw ApiError.badRequest('INVALID_PAGINATION', 'Invalid page or pageSize');
    }
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
function clampInt(raw, fallback, min, max) {
    if (raw === undefined || raw === null || raw === '')
        return fallback;
    const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (!Number.isInteger(value))
        return NaN;
    return Math.min(max, Math.max(min, value));
}
export function toPage(items, total, { page, pageSize }) {
    return { items, total, page, pageSize };
}
