import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HrmsDashboardService } from './hrms-dashboard.service';

@Controller(['hrms/dashboard', 'hrms-dashboard'])
export class HrmsDashboardController {
  constructor(private readonly dashboard: HrmsDashboardService) {}

  @Get(['', 'summary'])
  @RequirePermission(PERMISSIONS.hrmsRead)
  async getDashboard() {
    return this.dashboard.getDashboardData();
  }
}
