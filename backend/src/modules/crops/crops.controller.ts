import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CropsService } from './crops.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';

@Controller('crops')
export class CropsController {
  constructor(private readonly crops: CropsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.cropRead)
  async list(@CurrentEmployee() actor: AuthEmployee, @Query('includeInactive') includeInactive?: string) {
    return this.crops.list(includeInactive === 'true', actor);
  }

  @Post()
  @RequirePermission(PERMISSIONS.cropManage)
  async create(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateCropDto) {
    return this.crops.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.cropManage)
  async update(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: UpdateCropDto) {
    return this.crops.update(actor, id, dto);
  }
}
