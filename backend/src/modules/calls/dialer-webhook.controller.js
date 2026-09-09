var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d;
import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { ApiError } from '../../common/errors/api-error';
import { Public } from '../../common/decorators/public.decorator';
import { CallsService } from './calls.service';
import { DialerRegistry } from './dialer/dialer.registry';
import { WebhookIdempotencyService, extractCanonicalEventId } from '../../common/idempotency/webhook-idempotency.service';
import { WebhookStructuredLogger } from '../../common/logging/structured-logger.util';

/**
 * Status-push endpoint for telephony vendors (webhooks). Sits behind the same
 * AutoDialerProvider abstraction as everything else: the provider id selects
 * the adapter, which maps the vendor payload to a canonical snapshot. Guarded
 * by a shared secret (DIALER_WEBHOOK_SECRET) rather than session auth because
 * vendors cannot hold CRM sessions.
 *
 * Hardened with:
 *  - Canonical event identity extraction and deterministic UUID mapping
 *  - Idempotent processing via ProcessedEvent table and race-safe in-flight locking
 *  - Safe duplicate response without duplicate downstream mutations
 *  - Failure resilience (errors do NOT record events as processed)
 *  - Comprehensive structured logging with sensitive-field redaction (CWE-532 defense)
 */
let DialerWebhookController = class DialerWebhookController {
    constructor(dialers, calls, config, idempotency) {
        this.dialers = dialers;
        this.calls = calls;
        this.config = config;
        this.idempotency = idempotency;
        this.structuredLogger = new WebhookStructuredLogger('DialerWebhookController');
    }

    async webhook(providerId, secret, payload, reqId, eventIdHeader) {
        const startTime = Date.now();
        const correlationId = (typeof reqId === 'string' && reqId.trim())
            ? reqId.trim()
            : `req_${crypto.randomUUID().slice(0, 8)}`;

        const expected = this.config.get('DIALER_WEBHOOK_SECRET');
        if (!expected) {
            this.structuredLogger.error({
                provider: providerId,
                correlationId,
                result: 'CONFIG_ERROR',
                httpStatus: 503,
                durationMs: Date.now() - startTime,
                reason: 'Webhook endpoints are not configured (DIALER_WEBHOOK_SECRET unset)',
            });
            throw new ApiError(503, 'WEBHOOKS_DISABLED', 'Webhook endpoints are not configured (DIALER_WEBHOOK_SECRET unset)');
        }

        if (!secret || secret !== expected) {
            this.structuredLogger.warn({
                provider: providerId,
                correlationId,
                result: 'AUTH_FAILED',
                httpStatus: 401,
                durationMs: Date.now() - startTime,
                reason: 'Invalid webhook secret',
            });
            throw ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Invalid webhook secret');
        }

        if (!this.dialers.has(providerId)) {
            this.structuredLogger.warn({
                provider: providerId,
                correlationId,
                result: 'PROVIDER_NOT_FOUND',
                httpStatus: 404,
                durationMs: Date.now() - startTime,
                reason: `Unknown dialer provider: ${providerId}`,
            });
            throw ApiError.notFound('PROVIDER_NOT_FOUND', `Unknown dialer provider: ${providerId}`);
        }

        const provider = this.dialers.get(providerId);
        if (!provider.handleWebhook) {
            this.structuredLogger.info({
                provider: providerId,
                correlationId,
                result: 'IGNORED',
                httpStatus: 200,
                durationMs: Date.now() - startTime,
                reason: 'provider does not accept webhooks',
            });
            return { received: true, ignored: true, reason: 'provider does not accept webhooks' };
        }

        const snapshot = await provider.handleWebhook(payload);
        if (!snapshot) {
            this.structuredLogger.info({
                provider: providerId,
                correlationId,
                result: 'IGNORED',
                httpStatus: 200,
                durationMs: Date.now() - startTime,
                payload,
                reason: 'unrecognized provider call',
            });
            return { received: true, ignored: true, reason: 'unrecognized provider call' };
        }

        // Canonical event identifier extraction
        const eventId = extractCanonicalEventId(providerId, { 'x-event-id': eventIdHeader }, payload, snapshot);
        if (!eventId) {
            this.structuredLogger.warn({
                provider: providerId,
                correlationId,
                result: 'INVALID_PAYLOAD',
                httpStatus: 400,
                durationMs: Date.now() - startTime,
                reason: 'Unable to determine canonical event identity from webhook payload',
            });
            throw ApiError.badRequest('INVALID_PAYLOAD', 'Unable to determine canonical event identity');
        }

        const consumerName = `dialer-webhook:${providerId}`;

        try {
            const idempResult = await this.idempotency.processIdempotent({
                consumerName,
                rawEventId: eventId,
                execute: async () => {
                    await this.calls.syncSnapshotFromWebhook(providerId, snapshot);
                    return { received: true, applied: true };
                },
            });

            const durationMs = Date.now() - startTime;

            if (idempResult.duplicate) {
                this.structuredLogger.info({
                    provider: providerId,
                    eventId,
                    canonicalEventId: idempResult.canonicalEventId,
                    correlationId,
                    result: 'DUPLICATE',
                    httpStatus: 200,
                    durationMs,
                    payload,
                });
                return { received: true, duplicate: true, applied: false };
            }

            this.structuredLogger.info({
                provider: providerId,
                eventId,
                canonicalEventId: idempResult.canonicalEventId,
                correlationId,
                result: 'SUCCESS',
                httpStatus: 201,
                durationMs,
                payload,
            });
            return { received: true, applied: true };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            this.structuredLogger.error({
                provider: providerId,
                eventId,
                correlationId,
                result: 'ERROR',
                httpStatus: err.status || 500,
                durationMs,
                payload,
                error: err,
            });
            throw err;
        }
    }
};
__decorate([
    Post('webhooks/:provider'),
    Public(),
    __param(0, Param('provider')),
    __param(1, Headers('x-webhook-secret')),
    __param(2, Body()),
    __param(3, Headers('x-request-id')),
    __param(4, Headers('x-event-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], DialerWebhookController.prototype, "webhook", null);
DialerWebhookController = __decorate([
    Controller('dialer'),
    __metadata("design:paramtypes", [
        typeof (_a = typeof DialerRegistry !== "undefined" && DialerRegistry) === "function" ? _a : Object,
        typeof (_b = typeof CallsService !== "undefined" && CallsService) === "function" ? _b : Object,
        typeof (_c = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _c : Object,
        typeof (_d = typeof WebhookIdempotencyService !== "undefined" && WebhookIdempotencyService) === "function" ? _d : Object,
    ])
], DialerWebhookController);
export { DialerWebhookController };
