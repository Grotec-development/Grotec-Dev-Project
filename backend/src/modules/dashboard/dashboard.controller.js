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
import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardService, toDashboardRange, toPipelineState } from './dashboard.service';
let DashboardController = class DashboardController {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    async summary(actor, range) {
        return this.dashboard.summary(actor, toDashboardRange(range));
    }
    async pipeline(actor, state) {
        return this.dashboard.pipeline(actor, toPipelineState(state));
    }
};
__decorate([
    Get('summary'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('range')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "summary", null);
__decorate([
    Get('pipeline'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "pipeline", null);
DashboardController = __decorate([
    Controller('dashboard'),
    __metadata("design:paramtypes", [typeof (_a = typeof DashboardService !== "undefined" && DashboardService) === "function" ? _a : Object])
], DashboardController);
export { DashboardController };
