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
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RoutesService } from './routes.service';

let RoutesController = class RoutesController {
    constructor(routes) {
        this.routes = routes;
    }

    async listRoutes(includeInactive) {
        return this.routes.listRoutes(includeInactive === 'true' || includeInactive === '1');
    }

    async getRouteDashboard(query) {
        return this.routes.getRouteDashboard(query);
    }

    async getRouteById(id) {
        return this.routes.getRouteById(id);
    }

    async assignDistrict(actor, id, body) {
        return this.routes.assignDistrict(actor, id, body);
    }

    async removeDistrict(actor, id, district) {
        return this.routes.removeDistrict(actor, id, district);
    }

    async confirmCustomerDelivery(actor, orderId, body) {
        return this.routes.confirmCustomerDelivery(actor, orderId, body);
    }
};

__decorate([
    Get(),
    __param(0, Query('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "listRoutes", null);

__decorate([
    Get('dashboard'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "getRouteDashboard", null);

__decorate([
    Get(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "getRouteById", null);

__decorate([
    Post(':id/districts'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "assignDistrict", null);

__decorate([
    Delete(':id/districts/:district'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('district')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "removeDistrict", null);

__decorate([
    Post('orders/:orderId/confirm-delivery'),
    __param(0, CurrentEmployee()),
    __param(1, Param('orderId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RoutesController.prototype, "confirmCustomerDelivery", null);

RoutesController = __decorate([
    Controller('routes'),
    __metadata("design:paramtypes", [RoutesService])
], RoutesController);

export { RoutesController };
