import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeNoteDto } from './dto/create-employee-note.dto';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';
import { CreateEmployeeHistoryDto } from './dto/create-employee-history.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.employeeRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('roleCode') roleCode?: string,
    @Query('department') department?: string,
    @Query('designation') designation?: string,
    @Query('employmentStatus') employmentStatus?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.employees.list(actor, parsePagination(page, pageSize), {
      q,
      status: status as never,
      roleCode,
      department,
      designation,
      employmentStatus: employmentStatus as never,
      sort,
    });
  }

  @Post()
  @RequirePermission(PERMISSIONS.employeeCreate)
  async create(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(actor, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.employeeRead)
  async get(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.get(actor, id);
  }

  @Get(':id/profile')
  async getProfile(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfile(actor, id);
  }

  @Get(':id/profile/performance')
  async getProfilePerformance(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfilePerformance(actor, id);
  }

  @Get(':id/profile/attendance')
  async getProfileAttendance(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileAttendance(actor, id);
  }

  @Get(':id/profile/leave')
  async getProfileLeave(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileLeave(actor, id);
  }

  @Get(':id/profile/salary')
  async getProfileSalary(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileSalary(actor, id);
  }

  @Get(':id/profile/advances')
  async getProfileAdvances(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileAdvances(actor, id);
  }

  @Get(':id/profile/history')
  async getProfileHistory(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileHistory(actor, id);
  }

  @Get(':id/profile/documents')
  async getProfileDocuments(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.getProfileDocuments(actor, id);
  }

  @Post(':id/documents')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async addDocument(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() body: CreateEmployeeDocumentDto,
  ) {
    return this.employees.addDocument(actor, id, body);
  }

  @Delete(':id/documents/:docId')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async deleteDocument(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.employees.deleteDocument(actor, id, docId);
  }

  @Post(':id/notes')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async createNote(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: CreateEmployeeNoteDto,
  ) {
    return this.employees.createNote(actor, id, dto);
  }

  @Get(':id/notes')
  @RequirePermission(PERMISSIONS.employeeRead)
  async listNotes(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.listNotes(actor, id);
  }

  @Post(':id/history')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async addHistory(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: CreateEmployeeHistoryDto,
  ) {
    return this.employees.addHistory(actor, id, dto);
  }

  @Post(':id/assignments')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async assignStaff(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Body() dto: AssignStaffDto,
  ) {
    return this.employees.assignStaff(actor, id, dto.staffEmployeeId);
  }

  @Delete(':id/assignments/:staffId')
  @RequirePermission(PERMISSIONS.employeeUpdate)
  async unassignStaff(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.employees.unassignStaff(actor, id, staffId);
  }

  @Get(':id/assignments')
  @RequirePermission(PERMISSIONS.employeeRead)
  async listAssignments(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.employees.listAssignments(actor, id);
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
