var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
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
let CustomersController = class CustomersController {
    constructor(customers) {
        this.customers = customers;
    }
    async list(actor, q, phone, status, cropId, ownerId, page, pageSize) {
        return this.customers.list(actor, parsePagination(page, pageSize), {
            q,
            phone,
            status: status,
            cropId,
            ownerId,
        });
    }
    async lookupByPhone(phone) {
        return this.customers.lookupByPhone(phone);
    }
    async create(actor, dto) {
        return this.customers.create(actor, dto);
    }
    async detail(actor, id) {
        return this.customers.detailOrThrow(id, actor);
    }
    async update(actor, id, dto) {
        return this.customers.update(actor, id, dto);
    }
    async activate(actor, id) {
        await this.customers.setActive(actor, id, true);
    }
    async deactivate(actor, id) {
        await this.customers.setActive(actor, id, false);
    }
    // ------------------------------------------------------------- sub-resources
    async addPhone(actor, id, dto) {
        return this.customers.addPhone(actor, id, dto);
    }
    async updatePhone(actor, id, phoneId, dto) {
        return this.customers.updatePhone(actor, id, phoneId, dto);
    }
    async removePhone(actor, id, phoneId) {
        await this.customers.removePhone(actor, id, phoneId);
    }
    async addLocation(actor, id, dto) {
        return this.customers.addLocation(actor, id, dto);
    }
    async updateLocation(actor, id, locationId, dto) {
        return this.customers.updateLocation(actor, id, locationId, dto);
    }
    async removeLocation(actor, id, locationId) {
        await this.customers.removeLocation(actor, id, locationId);
    }
    async addCrop(actor, id, dto) {
        return this.customers.addCrop(actor, id, dto);
    }
    async updateCrop(actor, id, customerCropId, dto) {
        return this.customers.updateCrop(actor, id, customerCropId, dto);
    }
    async removeCrop(actor, id, customerCropId) {
        await this.customers.removeCrop(actor, id, customerCropId);
    }
    async listNotes(actor, id) {
        return this.customers.listNotes(id, actor);
    }
    async addNote(actor, id, dto) {
        return this.customers.addNote(id, actor, dto.body);
    }
};
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('q')),
    __param(2, Query('phone')),
    __param(3, Query('status')),
    __param(4, Query('cropId')),
    __param(5, Query('ownerId')),
    __param(6, Query('page')),
    __param(7, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "list", null);
__decorate([
    Get('lookup'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, Query('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "lookupByPhone", null);
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.customerCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreateCustomerDto !== "undefined" && CreateCustomerDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "create", null);
__decorate([
    Get(':id'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "detail", null);
__decorate([
    Patch(':id'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof UpdateCustomerDto !== "undefined" && UpdateCustomerDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "update", null);
__decorate([
    HttpCode(204),
    Post(':id/activate'),
    RequirePermission(PERMISSIONS.customerDeactivate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "activate", null);
__decorate([
    HttpCode(204),
    Post(':id/deactivate'),
    RequirePermission(PERMISSIONS.customerDeactivate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "deactivate", null);
__decorate([
    Post(':id/phones'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_d = typeof AddPhoneDto !== "undefined" && AddPhoneDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addPhone", null);
__decorate([
    Patch(':id/phones/:phoneId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('phoneId')),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, typeof (_e = typeof UpdatePhoneDto !== "undefined" && UpdatePhoneDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updatePhone", null);
__decorate([
    HttpCode(204),
    Delete(':id/phones/:phoneId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('phoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removePhone", null);
__decorate([
    Post(':id/locations'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_f = typeof LocationInputDto !== "undefined" && LocationInputDto) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addLocation", null);
__decorate([
    Patch(':id/locations/:locationId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('locationId')),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, typeof (_g = typeof UpdateLocationDto !== "undefined" && UpdateLocationDto) === "function" ? _g : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateLocation", null);
__decorate([
    HttpCode(204),
    Delete(':id/locations/:locationId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removeLocation", null);
__decorate([
    Post(':id/crops'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_h = typeof CropInputDto !== "undefined" && CropInputDto) === "function" ? _h : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addCrop", null);
__decorate([
    Patch(':id/crops/:customerCropId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('customerCropId')),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, typeof (_j = typeof UpdateCustomerCropDto !== "undefined" && UpdateCustomerCropDto) === "function" ? _j : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateCrop", null);
__decorate([
    HttpCode(204),
    Delete(':id/crops/:customerCropId'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('customerCropId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removeCrop", null);
__decorate([
    Get(':id/notes'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "listNotes", null);
__decorate([
    Post(':id/notes'),
    RequirePermission(PERMISSIONS.customerUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_k = typeof AddCustomerNoteDto !== "undefined" && AddCustomerNoteDto) === "function" ? _k : Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addNote", null);
CustomersController = __decorate([
    Controller('customers'),
    __metadata("design:paramtypes", [typeof (_a = typeof CustomersService !== "undefined" && CustomersService) === "function" ? _a : Object])
], CustomersController);
export { CustomersController };
