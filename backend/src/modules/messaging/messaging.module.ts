import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { MessagingRegistry } from './messaging.registry';
import { MessagingService } from './messaging.service';

@Module({
  imports: [AuditModule],
  providers: [MessagingRegistry, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
