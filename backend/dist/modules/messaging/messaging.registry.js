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
exports.MessagingRegistry = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mock_messaging_provider_1 = require("./mock-messaging.provider");
let MessagingRegistry = class MessagingRegistry {
    providers = new Map();
    defaultId;
    constructor(config) {
        this.defaultId = config.get('MESSAGING_PROVIDER') ?? 'mock';
        this.register(new mock_messaging_provider_1.MockMessagingProvider());
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
exports.MessagingRegistry = MessagingRegistry;
exports.MessagingRegistry = MessagingRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MessagingRegistry);
//# sourceMappingURL=messaging.registry.js.map