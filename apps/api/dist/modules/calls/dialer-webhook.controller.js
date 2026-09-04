"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialerWebhookController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const api_error_1 = require("../../common/errors/api-error");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const calls_service_1 = require("./calls.service");
const dialer_registry_1 = require("./dialer/dialer.registry");
let DialerWebhookController = class DialerWebhookController {
    dialers;
    calls;
    config;
    constructor(dialers, calls, config) {
        this.dialers = dialers;
        this.calls = calls;
        this.config = config;
    }
    async webhook(providerId, secret, payload) {
        const expected = this.config.get('DIALER_WEBHOOK_SECRET');
        if (!expected) {
            throw new api_error_1.ApiError(503, 'WEBHOOKS_DISABLED', 'Webhook endpoints are not configured (DIALER_WEBHOOK_SECRET unset)');
        }
        if (!secret || secret !== expected) {
            throw api_error_1.ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Invalid webhook secret');
        }
        if (!this.dialers.has(providerId)) {
            throw api_error_1.ApiError.notFound('PROVIDER_NOT_FOUND', `Unknown dialer provider: ${providerId}`);
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
exports.DialerWebhookController = DialerWebhookController;
__decorate([
    (0, common_1.Post)('webhooks/:provider'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('provider')),
    __param(1, (0, common_1.Headers)('x-webhook-secret')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DialerWebhookController.prototype, "webhook", null);
exports.DialerWebhookController = DialerWebhookController = __decorate([
    (0, common_1.Controller)('dialer'),
    __metadata("design:paramtypes", [dialer_registry_1.DialerRegistry,
        calls_service_1.CallsService,
        config_1.ConfigService])
], DialerWebhookController);
//# sourceMappingURL=dialer-webhook.controller.js.map