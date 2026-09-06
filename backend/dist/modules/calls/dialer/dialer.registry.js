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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialerRegistry = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mock_auto_dialer_provider_1 = require("./mock-auto-dialer.provider");
let DialerRegistry = class DialerRegistry {
    providers = new Map();
    defaultId;
    constructor(config) {
        this.defaultId = config.get('DIALER_PROVIDER') ?? 'mock';
        this.register(new mock_auto_dialer_provider_1.MockAutoDialerProvider({
            providerId: 'mock',
            ringingMs: this.number(config, 'DIALER_RING_MS', 4000),
            connectDelayMs: this.number(config, 'DIALER_CONNECT_MS', 800),
            answerRate: this.number(config, 'DIALER_ANSWER_RATE', 1),
        }));
    }
    get(id) {
        const provider = this.providers.get(id ?? this.defaultId) ?? this.providers.get(this.defaultId);
        if (!provider)
            throw new Error(`No auto-dialer provider registered: ${id ?? this.defaultId}`);
        return provider;
    }
    has(id) {
        return this.providers.has(id);
    }
    listIds() {
        return [...this.providers.keys()];
    }
    register(provider) {
        this.providers.set(provider.id, provider);
    }
    number(config, key, fallback) {
        const raw = config.get(key);
        const value = raw === undefined ? Number.NaN : Number(raw);
        return Number.isFinite(value) ? value : fallback;
    }
};
exports.DialerRegistry = DialerRegistry;
exports.DialerRegistry = DialerRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DialerRegistry);
//# sourceMappingURL=dialer.registry.js.map