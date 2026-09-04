import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CustomersModule } from '../customers/customers.module';
import { CustomerCallsController } from './call-history.controller';
import { CallStatusSyncService } from './call-status-sync.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { DialerWebhookController } from './dialer-webhook.controller';
import { DialerRegistry } from './dialer/dialer.registry';

@Module({
  imports: [PrismaModule, AuditModule, CustomersModule],
  controllers: [CallsController, CustomerCallsController, DialerWebhookController],
  providers: [DialerRegistry, CallStatusSyncService, CallsService],
})
export class CallsModule {}