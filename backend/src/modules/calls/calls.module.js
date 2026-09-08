var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CustomersModule } from '../customers/customers.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CustomerCallsController } from './call-history.controller';
import { CallStatusSyncService } from './call-status-sync.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { DialerWebhookController } from './dialer-webhook.controller';
import { DialerRegistry } from './dialer/dialer.registry';
let CallsModule = class CallsModule {
};
CallsModule = __decorate([
    Module({
        imports: [PrismaModule, AuditModule, CustomersModule, MessagingModule],
        controllers: [CallsController, CustomerCallsController, DialerWebhookController],
        providers: [DialerRegistry, CallStatusSyncService, CallsService],
    })
], CallsModule);
export { CallsModule };
