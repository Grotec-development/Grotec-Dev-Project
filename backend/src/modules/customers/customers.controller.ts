import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { AddCustomerNoteDto } from './dto/add-note.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { CropInputDto } from './dto/customer-input.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateCustomerCropDto } from './dto/update-crop.dto';
import { LocationInputDto } from './dto/customer-input.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.customerRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('q') q?: string,
    @Query('phone') phone?: string,
    @Query('status') status?: string,
    @Query('cropId') cropId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customers.list(actor, parsePagination(page, pageSize), {
      q,
      phone,
      status: status as never,
      cropId,
      ownerId,
    });
  }

  @Get('lookup')
  @RequirePermission(PERMISSIONS.customerRead)
  async lookupByPhone(@Query('phone') phone: string) {
    return this.customers.lookupByPhone(phone);
  }

  @Post()
  @RequirePermission(PERMISSIONS.customerCreate)
  async create(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateCustomerDto) {
    return this.customers.create(actor, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.customerRead)
  async detail(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.customers.detailOrThrow(id, actor);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async update(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(actor, id, dto.fullName);
  }

  @HttpCode(204)
  @Post(':id/activate')
  @RequirePermission(PERMISSIONS.customerDeactivate)
  async activate(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    await this.customers.setActive(actor, id, true);
  }

  @HttpCode(204)
  @Post(':id/deactivate')
  @RequirePermission(PERMISSIONS.customerDeactivate)
  async deactivate(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    await this.customers.setActive(actor, id, false);
  }

  // ------------------------------------------------------------- sub-resources

  @Post(':id/phones')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async addPhone(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: AddPhoneDto) {
    return this.customers.addPhone(actor, id, dto);
  }

  @Patch(':id/phones/:phoneId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async updatePhone(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Param('phoneId') phoneId: string,
    @Body() dto: UpdatePhoneDto,
  ) {
    return this.customers.updatePhone(actor, id, phoneId, dto);
  }

  @HttpCode(204)
  @Delete(':id/phones/:phoneId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async removePhone(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Param('phoneId') phoneId: string) {
    await this.customers.removePhone(actor, id, phoneId);
  }

  @Post(':id/locations')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async addLocation(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: LocationInputDto) {
    return this.customers.addLocation(actor, id, dto);
  }

  @Patch(':id/locations/:locationId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async updateLocation(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.customers.updateLocation(actor, id, locationId, dto);
  }

  @HttpCode(204)
  @Delete(':id/locations/:locationId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async removeLocation(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Param('locationId') locationId: string) {
    await this.customers.removeLocation(actor, id, locationId);
  }

  @Post(':id/crops')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async addCrop(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: CropInputDto) {
    return this.customers.addCrop(actor, id, dto);
  }

  @Patch(':id/crops/:customerCropId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async updateCrop(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('id') id: string,
    @Param('customerCropId') customerCropId: string,
    @Body() dto: UpdateCustomerCropDto,
  ) {
    return this.customers.updateCrop(actor, id, customerCropId, dto);
  }

  @HttpCode(204)
  @Delete(':id/crops/:customerCropId')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async removeCrop(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Param('customerCropId') customerCropId: string) {
    await this.customers.removeCrop(actor, id, customerCropId);
  }

  @Get(':id/notes')
  @RequirePermission(PERMISSIONS.customerRead)
  async listNotes(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.customers.listNotes(id, actor);
  }

  @Post(':id/notes')
  @RequirePermission(PERMISSIONS.customerUpdate)
  async addNote(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: AddCustomerNoteDto) {
    return this.customers.addNote(id, actor, dto.body);
  }
}
