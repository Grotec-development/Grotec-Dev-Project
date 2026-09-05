import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LeaveStatus, PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { ApplyLeaveDto, CreateLeaveTypeDto, RejectLeaveDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('types')
  @RequirePermission(PERMISSIONS.leaveRead)
  async getTypes() {
    return this.leave.getTypes();
  }

  @Post('types')
  @RequirePermission(PERMISSIONS.leaveApprove)
  async createType(@Body() dto: CreateLeaveTypeDto) {
    return this.leave.createType(dto);
  }

  @Get('balances')
  @RequirePermission(PERMISSIONS.leaveRead)
  async getBalances(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
  ) {
    return this.leave.getBalances(actor, { employeeId, year });
  }

  @Get('applications')
  @RequirePermission(PERMISSIONS.leaveRead)
  async getApplications(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.leave.getApplications(actor, parsePagination(page, pageSize), {
      employeeId,
      status: status as LeaveStatus,
      leaveTypeId,
      year,
      format,
    });

    if (format === 'csv' && typeof result === 'string') {
      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader('Content-Disposition', 'attachment; filename="leave_applications.csv"');
      return result;
    }

    return result;
  }

  @Post('apply')
  @RequirePermission(PERMISSIONS.leaveApply)
  async apply(@CurrentEmployee() actor: AuthEmployee, @Body() dto: ApplyLeaveDto) {
    return this.leave.apply(actor, dto);
  }

  @Post([':id/approve', 'applications/:id/approve'])
  @RequirePermission(PERMISSIONS.leaveApprove)
  async approve(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.leave.approve(actor, id);
  }

  @Post([':id/reject', 'applications/:id/reject'])
  @RequirePermission(PERMISSIONS.leaveApprove)
  async reject(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leave.reject(actor, id, dto);
  }
}
