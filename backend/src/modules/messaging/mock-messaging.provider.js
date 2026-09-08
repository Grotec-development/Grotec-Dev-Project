var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessageStatus } from '@grotec/shared';
/**
 * Development messaging provider: delivers instantly by logging the message.
 * Replaced by a real SMS/WhatsApp/email adapter without touching business logic.
 */
let MockMessagingProvider = class MockMessagingProvider {
    constructor() {
        this.id = 'mock';
        this.logger = new Logger('MockMessaging');
    }
    send(input) {
        this.logger.log(`[mock send] -> ${input.to}: ${input.body.slice(0, 120)}`);
        return Promise.resolve({ providerMessageId: `mock_msg_${randomUUID()}`, status: MessageStatus.SENT });
    }
};
MockMessagingProvider = __decorate([
    Injectable()
], MockMessagingProvider);
export { MockMessagingProvider };
