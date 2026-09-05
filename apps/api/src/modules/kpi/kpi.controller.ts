import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ComputeKpiDto,
  CreateKpiReviewEntryDto,
  FreezeKpiScoreDto,
  UpsertKpiTargetDto,
} from './dto/kpi.dto';
import { KpiService } from './kpi.service';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Get('targets')
  @RequirePermission(PERMISSIONS.kpiRead)
  async getTargets(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('period') period?: string,
    @Query('employeeId') employeeId?: string,
    @Query('roleCode') roleCode?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.kpi.getTargets(actor, { period, employeeId, roleCode, teamId });
  }

  @Post('targets')
  @RequirePermission(PERMISSIONS.kpiManage)
  async upsertTarget(@CurrentEmployee() actor: AuthEmployee, @Body() dto: UpsertKpiTargetDto) {
    return this.kpi.upsertTarget(actor, dto);
  }

  @Post('compute')
  @RequirePermission(PERMISSIONS.kpiManage)
  async compute(
    @CurrentEmployee() actor: AuthEmployee,
    @Body() bodyDto: ComputeKpiDto,
    @Query('period') queryPeriod?: string,
  ) {
    const period = bodyDto.period || queryPeriod || new Date().toISOString().slice(0, 7);
    return this.kpi.compute(actor, { period });
  }

  @Post('review-entries')
  @RequirePermission(PERMISSIONS.kpiManage)
  async addReviewEntry(
    @CurrentEmployee() actor: AuthEmployee,
    @Body() dto: CreateKpiReviewEntryDto,
  ) {
    return this.kpi.addReviewEntry(actor, dto);
  }

  @Get('scores/:employeeId')
  @RequirePermission(PERMISSIONS.kpiRead)
  async getScore(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('employeeId') employeeId: string,
    @Query('period') period?: string,
  ) {
    return this.kpi.getScore(actor, employeeId, period || new Date().toISOString().slice(0, 7));
  }

  @Get('scores/:employeeId/:period')
  @RequirePermission(PERMISSIONS.kpiRead)
  async getScoreByPeriod(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('employeeId') employeeId: string,
    @Param('period') period: string,
  ) {
    return this.kpi.getScore(actor, employeeId, period);
  }

  @Post('scores/:employeeId/freeze')
  @RequirePermission(PERMISSIONS.kpiManage)
  async freezeScore(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('employeeId') employeeId: string,
    @Body() dto: FreezeKpiScoreDto,
  ) {
    const period = dto.period || new Date().toISOString().slice(0, 7);
    return this.kpi.freezeScore(actor, employeeId, period, dto);
  }

  @Post('freeze/:employeeId/:period')
  @RequirePermission(PERMISSIONS.kpiManage)
  async freezeScoreByPeriod(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('employeeId') employeeId: string,
    @Param('period') period: string,
    @Body() dto: FreezeKpiScoreDto,
  ) {
    return this.kpi.freezeScore(actor, employeeId, period, dto);
  }

  @Get('team-summary/:period')
  @RequirePermission(PERMISSIONS.kpiRead)
  async getTeamSummary(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('period') period: string,
  ) {
    return this.kpi.getTeamSummary(actor, period);
  }
}
