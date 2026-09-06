"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
    static badRequest(code, message, details) {
        return new ApiError(400, code, message, details);
    }
    static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required') {
        return new ApiError(401, code, message);
    }
    static forbidden(code = 'FORBIDDEN', message = 'You do not have permission to do this') {
        return new ApiError(403, code, message);
    }
    static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
        return new ApiError(404, code, message);
    }
    static conflict(code, message, details) {
        return new ApiError(409, code, message, details);
    }
    static tooManyRequests(code = 'TOO_MANY_ATTEMPTS', message = 'Too many attempts, try again later') {
        return new ApiError(429, code, message);
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=api-error.js.map