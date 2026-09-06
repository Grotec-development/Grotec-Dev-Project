import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuditModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
