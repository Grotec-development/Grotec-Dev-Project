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
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OrdersService } from './orders.service';

let OrdersController = class OrdersController {
    constructor(orders) {
        this.orders = orders;
    }

    async listOrders(actor, query) {
        return this.orders.listOrders(actor, query);
    }

    async getAccountsLedger(actor, query) {
        return this.orders.getAccountsLedger(actor, query);
    }

    async getOrderById(actor, id) {
        return this.orders.getOrderById(actor, id);
    }

    async createOrder(actor, body) {
        return this.orders.createOrder(actor, body);
    }

    async updateOrderStatus(actor, id, body) {
        return this.orders.updateOrderStatus(actor, id, body.status);
    }

    async approveDiscount(actor, id, body) {
        return this.orders.approveDiscount(actor, id, body);
    }

    async rejectDiscount(actor, id, body) {
        return this.orders.rejectDiscount(actor, id, body);
    }

    async approveAdvanceException(actor, id, body) {
        return this.orders.approveAdvanceException(actor, id, body);
    }

    async recordPayment(actor, id, body) {
        return this.orders.recordPayment(actor, id, body);
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
], OrdersController.prototype, "listOrders", null);

__decorate([
    Get('ledger'),
    RequirePermission('orders.read'),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getAccountsLedger", null);

__decorate([
    Get(':id'),
    RequirePermission('orders.read'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrderById", null);

__decorate([
    Post(),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "createOrder", null);

__decorate([
    Patch(':id/status'),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateOrderStatus", null);

__decorate([
    Post(':id/discount/approve'),
    HttpCode(200),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "approveDiscount", null);

__decorate([
    Post(':id/discount/reject'),
    HttpCode(200),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "rejectDiscount", null);

__decorate([
    Post(':id/advance/exception'),
    HttpCode(200),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "approveAdvanceException", null);

__decorate([
    Post(':id/payments'),
    RequirePermission('orders.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "recordPayment", null);

OrdersController = __decorate([
    ApiTags('Orders'),
    ApiBearerAuth(),
    Controller('orders'),
    __metadata("design:paramtypes", [typeof (_a = typeof OrdersService !== "undefined" && OrdersService) === "function" ? _a : Object])
], OrdersController);

export { OrdersController };
