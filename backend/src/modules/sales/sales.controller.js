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
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SalesService } from './sales.service';

let SalesController = class SalesController {
    constructor(sales) {
        this.sales = sales;
    }

    async listSales(actor, query) {
        return this.sales.listSales(actor, query);
    }

    async getSaleById(actor, id) {
        return this.sales.getSaleById(actor, id);
    }

    async completeSale(actor, id, body) {
        return this.sales.completeSale(actor, id, body);
    }

    async getInvoice(actor, id) {
        return this.sales.getOrGenerateInvoice(actor, id);
    }
};

__decorate([
    Get(),
    RequirePermission('orders.read'),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "listSales", null);

__decorate([
    Get(':id'),
    RequirePermission('orders.read'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "getSaleById", null);

__decorate([
    Post(':id/complete'),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "completeSale", null);

__decorate([
    Get('orders/:id/invoice'),
    RequirePermission('orders.read'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "getInvoice", null);

SalesController = __decorate([
    Controller('sales'),
    __metadata("design:paramtypes", [SalesService])
], SalesController);

export { SalesController };
