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
import { MockMessagingProvider } from './mock-messaging.provider';
/**
 * Selects the active MessagingProvider (config MESSAGING_PROVIDER, default
 * `mock`). A production vendor adapter is registered here when selected —
 * business logic never names a vendor directly.
 */
let MessagingRegistry = class MessagingRegistry {
    constructor(config) {
        this.providers = new Map();
        this.defaultId = config.get('MESSAGING_PROVIDER') ?? 'mock';
        this.register(new MockMessagingProvider());
    }
    get(id) {
        const provider = this.providers.get(id ?? this.defaultId) ?? this.providers.get(this.defaultId);
        if (!provider)
            throw new Error(`No messaging provider registered: ${id ?? this.defaultId}`);
        return provider;
    }
    register(provider) {
        this.providers.set(provider.id, provider);
    }
};
MessagingRegistry = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _a : Object])
], MessagingRegistry);
export { MessagingRegistry };
