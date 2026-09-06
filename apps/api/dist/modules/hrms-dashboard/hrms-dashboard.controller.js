"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmsDashboardController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const hrms_dashboard_service_1 = require("./hrms-dashboard.service");
let HrmsDashboardController = class HrmsDashboardController {
    dashboard;
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    async getDashboard() {
        return this.dashboard.getDashboardData();
    }
};
exports.HrmsDashboardController = HrmsDashboardController;
__decorate([
    (0, common_1.Get)(['', 'summary']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.hrmsRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HrmsDashboardController.prototype, "getDashboard", null);
exports.HrmsDashboardController = HrmsDashboardController = __decorate([
    (0, common_1.Controller)(['hrms/dashboard', 'hrms-dashboard']),
    __metadata("design:paramtypes", [hrms_dashboard_service_1.HrmsDashboardService])
], HrmsDashboardController);
//# sourceMappingURL=hrms-dashboard.controller.js.map