import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';

@Module({
  imports: [AuditModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
})
export class FollowUpsModule {}
