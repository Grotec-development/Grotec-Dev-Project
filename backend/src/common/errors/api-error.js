/**
 * Domain-level error carrying the REST status and a stable machine-readable code.
 * Serialized by HttpExceptionFilter into the standard error envelope:
 * { error: { code, message, details? } }
 */
export class ApiError extends Error {
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
