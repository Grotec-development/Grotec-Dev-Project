import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardService, toDashboardRange, toPipelineState } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermission(PERMISSIONS.callRead)
  async summary(@CurrentEmployee() actor: AuthEmployee, @Query('range') range?: string) {
    return this.dashboard.summary(actor, toDashboardRange(range));
  }

  @Get('pipeline')
  @RequirePermission(PERMISSIONS.callRead)
  async pipeline(@CurrentEmployee() actor: AuthEmployee, @Query('state') state?: string) {
    return this.dashboard.pipeline(actor, toPipelineState(state));
  }
}
