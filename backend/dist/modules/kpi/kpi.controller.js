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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KpiController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const kpi_dto_1 = require("./dto/kpi.dto");
const kpi_service_1 = require("./kpi.service");
let KpiController = class KpiController {
    kpi;
    constructor(kpi) {
        this.kpi = kpi;
    }
    async getTargets(actor, period, employeeId, roleCode, teamId) {
        return this.kpi.getTargets(actor, { period, employeeId, roleCode, teamId });
    }
    async upsertTarget(actor, dto) {
        return this.kpi.upsertTarget(actor, dto);
    }
    async compute(actor, bodyDto, queryPeriod) {
        const period = bodyDto.period || queryPeriod || new Date().toISOString().slice(0, 7);
        return this.kpi.compute(actor, { period });
    }
    async addReviewEntry(actor, dto) {
        return this.kpi.addReviewEntry(actor, dto);
    }
    async getMyScore(actor, period) {
        return this.kpi.getMyScore(actor, period || new Date().toISOString().slice(0, 7));
    }
    async getMyScoreByPeriod(actor, period) {
        return this.kpi.getMyScore(actor, period);
    }
    async getScore(actor, employeeId, period) {
        return this.kpi.getScore(actor, employeeId, period || new Date().toISOString().slice(0, 7));
    }
    async getScoreByPeriod(actor, employeeId, period) {
        return this.kpi.getScore(actor, employeeId, period);
    }
    async freezeScore(actor, employeeId, dto) {
        const period = dto.period || new Date().toISOString().slice(0, 7);
        return this.kpi.freezeScore(actor, employeeId, period, dto);
    }
    async freezeScoreByPeriod(actor, employeeId, period, dto) {
        return this.kpi.freezeScore(actor, employeeId, period, dto);
    }
    async getTeamSummary(actor, period) {
        return this.kpi.getTeamSummary(actor, period);
    }
};
exports.KpiController = KpiController;
__decorate([
    (0, common_1.Get)('targets'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('period')),
    __param(2, (0, common_1.Query)('employeeId')),
    __param(3, (0, common_1.Query)('roleCode')),
    __param(4, (0, common_1.Query)('teamId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getTargets", null);
__decorate([
    (0, common_1.Post)('targets'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, kpi_dto_1.UpsertKpiTargetDto]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "upsertTarget", null);
__decorate([
    (0, common_1.Post)('compute'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, kpi_dto_1.ComputeKpiDto, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "compute", null);
__decorate([
    (0, common_1.Post)('review-entries'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, kpi_dto_1.CreateKpiReviewEntryDto]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "addReviewEntry", null);
__decorate([
    (0, common_1.Get)('my/score'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getMyScore", null);
__decorate([
    (0, common_1.Get)('my/score/:period'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getMyScoreByPeriod", null);
__decorate([
    (0, common_1.Get)('scores/:employeeId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __param(2, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getScore", null);
__decorate([
    (0, common_1.Get)('scores/:employeeId/:period'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __param(2, (0, common_1.Param)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getScoreByPeriod", null);
__decorate([
    (0, common_1.Post)('scores/:employeeId/freeze'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, kpi_dto_1.FreezeKpiScoreDto]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "freezeScore", null);
__decorate([
    (0, common_1.Post)('freeze/:employeeId/:period'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __param(2, (0, common_1.Param)('period')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, kpi_dto_1.FreezeKpiScoreDto]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "freezeScoreByPeriod", null);
__decorate([
    (0, common_1.Get)('team-summary/:period'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.kpiManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getTeamSummary", null);
exports.KpiController = KpiController = __decorate([
    (0, common_1.Controller)('kpi'),
    __metadata("design:paramtypes", [kpi_service_1.KpiService])
], KpiController);
//# sourceMappingURL=kpi.controller.js.map