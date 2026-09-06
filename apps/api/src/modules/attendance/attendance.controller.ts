import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApprovalStatus,
  AttendanceSource,
  AttendanceStatus,
  PERMISSIONS,
} from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { AttendanceService } from './attendance.service';
import {
  BulkAttendanceDto,
  CorrectAttendanceDto,
  CreateEsslDeviceDto,
  CreateEsslMappingDto,
  EsslWebhookDto,
  MarkAttendanceDto,
  RejectAttendanceDto,
  SyncEsslDto,
} from './dto/attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('my')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async listMy(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.attendance.listMy(actor, parsePagination(page, pageSize), {
      month,
      from,
      to,
      status: status as AttendanceStatus,
      source: source as AttendanceSource,
    });
  }

  @Get('my/summary')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async summaryMy(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('month') month?: string,
  ) {
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return this.attendance.getSummaryMy(actor, { month: targetMonth });
  }

  @Post('my/mark')
  @RequirePermission(PERMISSIONS.attendanceMark)
  async markMy(@CurrentEmployee() actor: AuthEmployee, @Body() dto: MarkAttendanceDto) {
    return this.attendance.markMy(actor, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.attendanceRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('employeeId') employeeId?: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.attendance.list(actor, parsePagination(page, pageSize), {
      employeeId,
      month,
      from,
      to,
      status: status as AttendanceStatus,
      approvalStatus: approvalStatus as ApprovalStatus,
      source: source as AttendanceSource,
    });
  }

  @Get('summary')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async summary(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('month') month: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return this.attendance.getSummary(actor, { month: targetMonth, employeeId });
  }

  @Get('roster')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async roster(@CurrentEmployee() actor: AuthEmployee) {
    return this.attendance.getRoster(actor);
  }

  @Post('mark')
  @RequirePermission(PERMISSIONS.attendanceMark)
  async mark(@CurrentEmployee() actor: AuthEmployee, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(actor, dto);
  }

  @Post('bulk')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async bulkMark(@CurrentEmployee() actor: AuthEmployee, @Body() dto: BulkAttendanceDto) {
    return this.attendance.bulkMark(actor, dto);
  }

  @Patch(':id/correct')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async correct(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendance.correct(actor, id, dto);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async approve(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.attendance.approve(actor, id);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async reject(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: RejectAttendanceDto,
  ) {
    return this.attendance.reject(actor, id, dto);
  }

  @Public()
  @Post('essl/webhook')
  async esslWebhook(
    @Headers('x-essl-secret') secret: string | undefined,
    @Body() dto: EsslWebhookDto,
  ) {
    return this.attendance.handleEsslWebhook(secret, dto);
  }

  @Post('essl/sync')
  @RequirePermission(PERMISSIONS.attendanceMark)
  async syncEssl(@CurrentEmployee() actor: AuthEmployee, @Body() dto: SyncEsslDto) {
    return this.attendance.syncEssl(actor, dto);
  }

  @Get('essl/devices')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async getDevices() {
    return this.attendance.getDevices();
  }

  @Post('essl/devices')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async createDevice(@Body() dto: CreateEsslDeviceDto) {
    return this.attendance.createDevice(dto);
  }

  @Get('essl/mappings')
  @RequirePermission(PERMISSIONS.attendanceRead)
  async getMappings(@Query('deviceId') deviceId?: string) {
    return this.attendance.getMappings(deviceId);
  }

  @Post('essl/mappings')
  @RequirePermission(PERMISSIONS.attendanceApprove)
  async createMapping(@Body() dto: CreateEsslMappingDto) {
    return this.attendance.createMapping(dto);
  }
}
