var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HrmsDashboardService } from './hrms-dashboard.service';
let HrmsDashboardController = class HrmsDashboardController {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    async getDashboard() {
        return this.dashboard.getDashboardData();
    }
};
__decorate([
    Get(['', 'summary']),
    RequirePermission(PERMISSIONS.hrmsRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HrmsDashboardController.prototype, "getDashboard", null);
HrmsDashboardController = __decorate([
    Controller(['hrms/dashboard', 'hrms-dashboard']),
    __metadata("design:paramtypes", [typeof (_a = typeof HrmsDashboardService !== "undefined" && HrmsDashboardService) === "function" ? _a : Object])
], HrmsDashboardController);
export { HrmsDashboardController };
