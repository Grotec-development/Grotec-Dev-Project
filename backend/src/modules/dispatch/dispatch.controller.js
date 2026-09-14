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
import { DispatchService } from './dispatch.service';

let DispatchController = class DispatchController {
    constructor(dispatch) {
        this.dispatch = dispatch;
    }

    async listVehicles() {
        return this.dispatch.listVehicles();
    }

    async createVehicle(actor, body) {
        return this.dispatch.createVehicle(actor, body);
    }

    async listTrips(actor, query) {
        return this.dispatch.listTrips(actor, query);
    }

    async getTripById(id) {
        return this.dispatch.getTripById(id);
    }

    async createTrip(actor, body) {
        return this.dispatch.createTrip(actor, body);
    }

    async verifyLoading(actor, id, body) {
        return this.dispatch.verifyLoading(actor, id, body);
    }

    async dispatchTrip(actor, id, body) {
        return this.dispatch.dispatchTrip(actor, id, body);
    }

    async closeTrip(actor, id, body) {
        return this.dispatch.closeTrip(actor, id, body);
    }
};

__decorate([
    Get('vehicles'),
    RequirePermission('dispatch.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "listVehicles", null);

__decorate([
    Post('vehicles'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "createVehicle", null);

__decorate([
    Get('trips'),
    RequirePermission('dispatch.read'),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "listTrips", null);

__decorate([
    Get('trips/:id'),
    RequirePermission('dispatch.read'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "getTripById", null);

__decorate([
    Post('trips'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "createTrip", null);

__decorate([
    Post('trips/:id/verify-loading'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "verifyLoading", null);

__decorate([
    Post('trips/:id/dispatch'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "dispatchTrip", null);

__decorate([
    Post('trips/:id/close'),
    RequirePermission('dispatch.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "closeTrip", null);

DispatchController = __decorate([
    ApiTags('Dispatch'),
    ApiBearerAuth(),
    Controller('dispatch'),
    __metadata("design:paramtypes", [typeof (_a = typeof DispatchService !== "undefined" && DispatchService) === "function" ? _a : Object])
], DispatchController);

export { DispatchController };
