"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.toPage = toPage;
const shared_1 = require("@grotec/shared");
const api_error_1 = require("../errors/api-error");
function parsePagination(pageRaw, sizeRaw) {
    const page = clampInt(pageRaw, shared_1.PAGINATION.DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampInt(sizeRaw, shared_1.PAGINATION.DEFAULT_PAGE_SIZE, 1, shared_1.PAGINATION.MAX_PAGE_SIZE);
    if (Number.isNaN(page) || Number.isNaN(pageSize)) {
        throw api_error_1.ApiError.badRequest('INVALID_PAGINATION', 'Invalid page or pageSize');
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
function toPage(items, total, { page, pageSize }) {
    return { items, total, page, pageSize };
}
//# sourceMappingURL=pagination.js.map