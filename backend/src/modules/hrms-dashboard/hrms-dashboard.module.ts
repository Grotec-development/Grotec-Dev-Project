import { Module } from '@nestjs/common';
import { HrmsDashboardController } from './hrms-dashboard.controller';
import { HrmsDashboardService } from './hrms-dashboard.service';

@Module({
  controllers: [HrmsDashboardController],
  providers: [HrmsDashboardService],
  exports: [HrmsDashboardService],
})
export class HrmsDashboardModule {}
