import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.leadRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.leads.list(actor, parsePagination(page, pageSize), {
      status: status as never,
      ownerId,
      q,
    });
  }

  @Post()
  @RequirePermission(PERMISSIONS.leadCreate)
  async create(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateLeadDto) {
    return this.leads.create(actor, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.leadRead)
  async detail(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.leads.detailOrThrow(id, actor);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.leadUpdate)
  async update(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(actor, id, dto);
  }

  @Get(':id/ownership-history')
  @RequirePermission(PERMISSIONS.leadRead)
  async ownershipHistory(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.leads.ownershipHistory(id, actor);
  }

  @Post(':id/assign')
  @RequirePermission(PERMISSIONS.leadAssign)
  async assign(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: AssignLeadDto) {
    return this.leads.assign(actor, id, dto);
  }
}
