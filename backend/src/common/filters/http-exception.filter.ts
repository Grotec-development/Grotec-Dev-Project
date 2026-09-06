import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../errors/api-error';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    matchedCustomer?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const envelope = this.toEnvelope(exception);
    if (envelope.error.code === 'INTERNAL_ERROR') {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }
    response.status(this.statusOf(exception)).json(envelope);
  }

  private statusOf(exception: unknown): number {
    if (exception instanceof ApiError) return exception.status;
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return 409;
      if (exception.code === 'P2025') return 404;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof ApiError) {
      const envelope: ErrorEnvelope = { error: { code: exception.code, message: exception.message } };
      if (exception.details !== undefined) {
        envelope.error.details = exception.details;
        // Hoist duplicate-customer matches so callers can attach to the existing
        // customer without unwrapping details (documented envelope shape).
        const matched = (exception.details as { matchedCustomer?: unknown } | null)?.matchedCustomer;
        if (matched) envelope.error.matchedCustomer = matched;
      }
      return envelope;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          error: {
            code: 'DUPLICATE',
            message: 'A record with the same unique value already exists',
            details: { target: exception.meta?.target },
          },
        };
      }
      if (exception.code === 'P2025') {
        return { error: { code: 'NOT_FOUND', message: 'Record not found' } };
      }
      return { error: { code: 'DB_ERROR', message: 'Database error', details: { code: exception.code } } };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return { error: { code: 'HTTP_ERROR', message: body } };
      }
      const obj = body as Record<string, unknown>;
      if (Array.isArray(obj.message)) {
        return {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { fields: obj.message },
          },
        };
      }
      return {
        error: {
          code: 'HTTP_ERROR',
          message: typeof obj.message === 'string' ? obj.message : exception.message,
        },
      };
    }

    return { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
  }
}
