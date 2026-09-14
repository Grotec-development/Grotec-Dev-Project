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
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { InventoryService } from './inventory.service';

let InventoryController = class InventoryController {
    constructor(inventory) {
        this.inventory = inventory;
    }

    async getStocks(query) {
        return this.inventory.getStocks(query);
    }

    async getMovements(query) {
        return this.inventory.getMovements(query);
    }

    async adjustStock(actor, body) {
        return this.inventory.adjustStock(actor, body);
    }
};

__decorate([
    Get('stocks'),
    RequirePermission('inventory.read'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getStocks", null);

__decorate([
    Get('movements'),
    RequirePermission('inventory.read'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getMovements", null);

__decorate([
    Post('adjust'),
    RequirePermission('inventory.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustStock", null);

InventoryController = __decorate([
    ApiTags('Inventory'),
    ApiBearerAuth(),
    Controller('inventory'),
    __metadata("design:paramtypes", [typeof (_a = typeof InventoryService !== "undefined" && InventoryService) === "function" ? _a : Object])
], InventoryController);

export { InventoryController };
