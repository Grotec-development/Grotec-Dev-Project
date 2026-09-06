"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMessagingProvider = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@grotec/shared");
let MockMessagingProvider = class MockMessagingProvider {
    id = 'mock';
    logger = new common_1.Logger('MockMessaging');
    send(input) {
        this.logger.log(`[mock send] -> ${input.to}: ${input.body.slice(0, 120)}`);
        return Promise.resolve({ providerMessageId: `mock_msg_${(0, node_crypto_1.randomUUID)()}`, status: shared_1.MessageStatus.SENT });
    }
};
exports.MockMessagingProvider = MockMessagingProvider;
exports.MockMessagingProvider = MockMessagingProvider = __decorate([
    (0, common_1.Injectable)()
], MockMessagingProvider);
//# sourceMappingURL=mock-messaging.provider.js.map