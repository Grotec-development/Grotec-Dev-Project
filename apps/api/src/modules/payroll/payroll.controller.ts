import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ApprovePayrollDto,
  CreateAdvanceDto,
  CreatePayrollRunDto,
  CreateSalaryRevisionDto,
  GeneratePayrollDto,
} from './dto/payroll.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('runs')
  @RequirePermission(PERMISSIONS.payrollManage)
  async listRuns(@CurrentEmployee() actor: AuthEmployee) {
    return this.payroll.listRuns(actor);
  }

  @Post('runs')
  @RequirePermission(PERMISSIONS.payrollManage)
  async createRun(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreatePayrollRunDto) {
    return this.payroll.createRun(actor, dto);
  }

  @Get('runs/:id')
  @RequirePermission(PERMISSIONS.payrollManage)
  async getRun(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.payroll.getRun(actor, id);
  }

  @Post(['generate', 'runs/:id/generate'])
  @RequirePermission(PERMISSIONS.payrollManage)
  async generate(
    @CurrentEmployee() actor: AuthEmployee,
    @Body() dto: GeneratePayrollDto,
    @Param('id') id?: string,
  ) {
    const month = dto.month || id;
    return this.payroll.generate(actor, { ...dto, month: month! });
  }

  @Post([':id/approve', 'runs/:id/approve'])
  @RequirePermission(PERMISSIONS.payrollApprove)
  async approve(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto?: ApprovePayrollDto,
  ) {
    return this.payroll.approve(actor, id, dto);
  }

  @Post([':id/publish', 'runs/:id/publish'])
  @RequirePermission(PERMISSIONS.payrollApprove)
  async publish(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.payroll.publish(actor, id);
  }

  @Get('payslips')
  @RequirePermission(PERMISSIONS.payrollRead)
  async getPayslips(@CurrentEmployee() actor: AuthEmployee, @Query('employeeId') employeeId?: string) {
    return this.payroll.getPayslips(actor, employeeId);
  }

  @Get('payslips/:id/pdf')
  @RequirePermission(PERMISSIONS.payrollRead)
  @Header('Content-Type', 'text/html')
  async getPayslipPdf(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.payroll.getPayslipPdf(actor, id);
  }

  @Get('payslips/:id')
  @RequirePermission(PERMISSIONS.payrollRead)
  async getPayslipDetail(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.payroll.getPayslipDetail(actor, id);
  }

  @Get('salary-revisions/:employeeId')
  @RequirePermission(PERMISSIONS.payrollRead)
  async getSalaryRevisions(@CurrentEmployee() actor: AuthEmployee, @Param('employeeId') employeeId: string) {
    return this.payroll.getSalaryRevisions(actor, employeeId);
  }

  @Post('salary-revisions')
  @RequirePermission(PERMISSIONS.payrollManage)
  async createSalaryRevision(
    @CurrentEmployee() actor: AuthEmployee,
    @Body() dto: CreateSalaryRevisionDto,
  ) {
    return this.payroll.createSalaryRevision(actor, dto);
  }

  @Get('advances')
  @RequirePermission(PERMISSIONS.payrollRead)
  async listAdvances(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.payroll.listAdvances(actor, { employeeId, status });
  }

  @Post('advances')
  @RequirePermission(PERMISSIONS.payrollManage)
  async createAdvance(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateAdvanceDto) {
    return this.payroll.createAdvance(actor, dto);
  }

  @Get('reports')
  @RequirePermission(PERMISSIONS.payrollManage)
  async getReports(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('month') month?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.payroll.getReports(actor, month, format);
    if (format === 'csv' && typeof result === 'string') {
      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader('Content-Disposition', `attachment; filename="payroll_report_${month || 'current'}.csv"`);
      return result;
    }
    return result;
  }
}
