import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.employeeRead)
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('roleCode') roleCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.employees.list(parsePagination(page, pageSize), { q, status: status as never, roleCode });
  }

  @Post()
  @RequirePermission(PERMISSIONS.employeeCreate)
  async create(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(actor, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.employeeRead)
  async get(@Param('id') id: string) {
    return this.employees.get(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async update(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(actor, id, dto);
  }

  @HttpCode(204)
  @Post(':id/activate')
  @RequirePermission(PERMISSIONS.employeeDeactivate)
  async activate(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    await this.employees.setActive(actor, id, true);
  }

  @HttpCode(204)
  @Post(':id/deactivate')
  @RequirePermission(PERMISSIONS.employeeDeactivate)
  async deactivate(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    await this.employees.setActive(actor, id, false);
  }

  @HttpCode(200)
  @Post(':id/reset-password')
  @RequirePermission(PERMISSIONS.employeeResetPassword)
  async resetPassword(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.employees.resetPassword(actor, id, dto);
  }
}
