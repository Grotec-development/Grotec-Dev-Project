var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockAutoDialerProvider } from './mock-auto-dialer.provider';
/**
 * Selects the active AutoDialerProvider. The mock is registered by default;
 * a production vendor adapter is registered here (config-selected) when chosen —
 * CRM business logic never names a vendor directly.
 */
let DialerRegistry = class DialerRegistry {
    constructor(config) {
        this.providers = new Map();
        this.defaultId = config.get('DIALER_PROVIDER') ?? 'mock';
        this.register(new MockAutoDialerProvider({
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
DialerRegistry = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _a : Object])
], DialerRegistry);
export { DialerRegistry };
