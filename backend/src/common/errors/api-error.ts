/**
 * Domain-level error carrying the REST status and a stable machine-readable code.
 * Serialized by HttpExceptionFilter into the standard error envelope:
 * { error: { code, message, details? } }
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required'): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'You do not have permission to do this'): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found'): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, details);
  }

  static tooManyRequests(code = 'TOO_MANY_ATTEMPTS', message = 'Too many attempts, try again later'): ApiError {
    return new ApiError(429, code, message);
  }
}
