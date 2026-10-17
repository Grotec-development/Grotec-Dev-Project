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
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SoilTypesService } from './soil-types.service';

let SoilTypesController = class SoilTypesController {
    constructor(soilTypes) {
        this.soilTypes = soilTypes;
    }

    async list(includeInactive) {
        return this.soilTypes.list(includeInactive === 'true' || includeInactive === '1');
    }

    async create(actor, body) {
        return this.soilTypes.create(actor, body);
    }

    async update(actor, id, body) {
        return this.soilTypes.update(actor, id, body);
    }
};

__decorate([
    Get(),
    __param(0, Query('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SoilTypesController.prototype, "list", null);

__decorate([
    Post(),
    RequirePermission('crop.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SoilTypesController.prototype, "create", null);

__decorate([
    Patch(':id'),
    RequirePermission('crop.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SoilTypesController.prototype, "update", null);

SoilTypesController = __decorate([
    Controller('soil-types'),
    __metadata("design:paramtypes", [SoilTypesService])
], SoilTypesController);

export { SoilTypesController };
