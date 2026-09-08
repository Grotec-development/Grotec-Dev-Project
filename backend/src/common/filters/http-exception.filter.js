var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
import { Catch, HttpException, HttpStatus, Logger, } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../errors/api-error';
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    constructor() {
        this.logger = new Logger(HttpExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const envelope = this.toEnvelope(exception);
        if (envelope.error.code === 'INTERNAL_ERROR') {
            this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
        }
        response.status(this.statusOf(exception)).json(envelope);
    }
    statusOf(exception) {
        if (exception instanceof ApiError)
            return exception.status;
        if (exception instanceof HttpException)
            return exception.getStatus();
        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002')
                return 409;
            if (exception.code === 'P2025')
                return 404;
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
    toEnvelope(exception) {
        if (exception instanceof ApiError) {
            const envelope = { error: { code: exception.code, message: exception.message } };
            if (exception.details !== undefined) {
                envelope.error.details = exception.details;
                // Hoist duplicate-customer matches so callers can attach to the existing
                // customer without unwrapping details (documented envelope shape).
                const matched = exception.details?.matchedCustomer;
                if (matched)
                    envelope.error.matchedCustomer = matched;
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
            const obj = body;
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
};
HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    Catch()
], HttpExceptionFilter);
export { HttpExceptionFilter };
