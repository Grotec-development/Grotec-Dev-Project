import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { CropsController } from './crops.controller';
import { CropsService } from './crops.service';

@Module({
  imports: [AuditModule],
  controllers: [CropsController],
  providers: [CropsService],
})
export class CropsModule {}
