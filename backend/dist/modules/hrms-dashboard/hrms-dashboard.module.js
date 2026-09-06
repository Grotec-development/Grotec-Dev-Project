"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmsDashboardModule = void 0;
const common_1 = require("@nestjs/common");
const hrms_dashboard_controller_1 = require("./hrms-dashboard.controller");
const hrms_dashboard_service_1 = require("./hrms-dashboard.service");
let HrmsDashboardModule = class HrmsDashboardModule {
};
exports.HrmsDashboardModule = HrmsDashboardModule;
exports.HrmsDashboardModule = HrmsDashboardModule = __decorate([
    (0, common_1.Module)({
        controllers: [hrms_dashboard_controller_1.HrmsDashboardController],
        providers: [hrms_dashboard_service_1.HrmsDashboardService],
        exports: [hrms_dashboard_service_1.HrmsDashboardService],
    })
], HrmsDashboardModule);
//# sourceMappingURL=hrms-dashboard.module.js.map