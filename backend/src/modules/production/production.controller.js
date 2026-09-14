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
var _a;
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ProductionService } from './production.service';

let ProductionController = class ProductionController {
    constructor(production) {
        this.production = production;
    }

    async listBatches(query) {
        return this.production.listBatches(query);
    }

    async getBatchById(id) {
        return this.production.getBatchById(id);
    }

    async createBatch(actor, body) {
        return this.production.createBatch(actor, body);
    }
};

__decorate([
    Get('batches'),
    RequirePermission('production.read'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listBatches", null);

__decorate([
    Get('batches/:id'),
    RequirePermission('production.read'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getBatchById", null);

__decorate([
    Post('batches'),
    RequirePermission('production.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createBatch", null);

ProductionController = __decorate([
    ApiTags('Production'),
    ApiBearerAuth(),
    Controller('production'),
    __metadata("design:paramtypes", [typeof (_a = typeof ProductionService !== "undefined" && ProductionService) === "function" ? _a : Object])
], ProductionController);

export { ProductionController };
