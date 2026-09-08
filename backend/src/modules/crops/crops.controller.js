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
var _a, _b, _c;
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CropsService } from './crops.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
let CropsController = class CropsController {
    constructor(crops) {
        this.crops = crops;
    }
    async list(actor, includeInactive) {
        return this.crops.list(includeInactive === 'true', actor);
    }
    async create(actor, dto) {
        return this.crops.create(actor, dto);
    }
    async update(actor, id, dto) {
        return this.crops.update(actor, id, dto);
    }
};
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.cropRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "list", null);
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.cropManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreateCropDto !== "undefined" && CreateCropDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "create", null);
__decorate([
    Patch(':id'),
    RequirePermission(PERMISSIONS.cropManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof UpdateCropDto !== "undefined" && UpdateCropDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "update", null);
CropsController = __decorate([
    Controller('crops'),
    __metadata("design:paramtypes", [typeof (_a = typeof CropsService !== "undefined" && CropsService) === "function" ? _a : Object])
], CropsController);
export { CropsController };
