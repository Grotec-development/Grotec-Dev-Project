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
var _a, _b, _c;
import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../../common/errors/api-error';
import { Public } from '../../common/decorators/public.decorator';
import { CallsService } from './calls.service';
import { DialerRegistry } from './dialer/dialer.registry';
/**
 * Status-push endpoint for telephony vendors (webhooks). Sits behind the same
 * AutoDialerProvider abstraction as everything else: the provider id selects
 * the adapter, which maps the vendor payload to a canonical snapshot. Guarded
 * by a shared secret (DIALER_WEBHOOK_SECRET) rather than session auth because
 * vendors cannot hold CRM sessions.
 */
let DialerWebhookController = class DialerWebhookController {
    constructor(dialers, calls, config) {
        this.dialers = dialers;
        this.calls = calls;
        this.config = config;
    }
    async webhook(providerId, secret, payload) {
        const expected = this.config.get('DIALER_WEBHOOK_SECRET');
        if (!expected) {
            throw new ApiError(503, 'WEBHOOKS_DISABLED', 'Webhook endpoints are not configured (DIALER_WEBHOOK_SECRET unset)');
        }
        if (!secret || secret !== expected) {
            throw ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Invalid webhook secret');
        }
        if (!this.dialers.has(providerId)) {
            throw ApiError.notFound('PROVIDER_NOT_FOUND', `Unknown dialer provider: ${providerId}`);
        }
        const provider = this.dialers.get(providerId);
        if (!provider.handleWebhook) {
            return { received: true, ignored: true, reason: 'provider does not accept webhooks' };
        }
        const snapshot = await provider.handleWebhook(payload);
        if (!snapshot) {
            return { received: true, ignored: true, reason: 'unrecognized provider call' };
        }
        await this.calls.syncSnapshotFromWebhook(providerId, snapshot);
        return { received: true, applied: true };
    }
};
__decorate([
    Post('webhooks/:provider'),
    Public(),
    __param(0, Param('provider')),
    __param(1, Headers('x-webhook-secret')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DialerWebhookController.prototype, "webhook", null);
DialerWebhookController = __decorate([
    Controller('dialer'),
    __metadata("design:paramtypes", [typeof (_a = typeof DialerRegistry !== "undefined" && DialerRegistry) === "function" ? _a : Object, typeof (_b = typeof CallsService !== "undefined" && CallsService) === "function" ? _b : Object, typeof (_c = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _c : Object])
], DialerWebhookController);
export { DialerWebhookController };
