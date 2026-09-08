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
var _a, _b, _c, _d, _e, _f;
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ComputeKpiDto, CreateKpiReviewEntryDto, FreezeKpiScoreDto, UpsertKpiTargetDto, } from './dto/kpi.dto';
import { KpiService } from './kpi.service';
let KpiController = class KpiController {
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
__decorate([
    Get('targets'),
    RequirePermission(PERMISSIONS.kpiRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('period')),
    __param(2, Query('employeeId')),
    __param(3, Query('roleCode')),
    __param(4, Query('teamId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getTargets", null);
__decorate([
    Post('targets'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof UpsertKpiTargetDto !== "undefined" && UpsertKpiTargetDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "upsertTarget", null);
__decorate([
    Post('compute'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __param(2, Query('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof ComputeKpiDto !== "undefined" && ComputeKpiDto) === "function" ? _c : Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "compute", null);
__decorate([
    Post('review-entries'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof CreateKpiReviewEntryDto !== "undefined" && CreateKpiReviewEntryDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "addReviewEntry", null);
__decorate([
    Get('my/score'),
    RequirePermission(PERMISSIONS.kpiRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getMyScore", null);
__decorate([
    Get('my/score/:period'),
    RequirePermission(PERMISSIONS.kpiRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getMyScoreByPeriod", null);
__decorate([
    Get('scores/:employeeId'),
    RequirePermission(PERMISSIONS.kpiRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('employeeId')),
    __param(2, Query('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getScore", null);
__decorate([
    Get('scores/:employeeId/:period'),
    RequirePermission(PERMISSIONS.kpiRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('employeeId')),
    __param(2, Param('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getScoreByPeriod", null);
__decorate([
    Post('scores/:employeeId/freeze'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('employeeId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_e = typeof FreezeKpiScoreDto !== "undefined" && FreezeKpiScoreDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "freezeScore", null);
__decorate([
    Post('freeze/:employeeId/:period'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('employeeId')),
    __param(2, Param('period')),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, typeof (_f = typeof FreezeKpiScoreDto !== "undefined" && FreezeKpiScoreDto) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "freezeScoreByPeriod", null);
__decorate([
    Get('team-summary/:period'),
    RequirePermission(PERMISSIONS.kpiManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getTeamSummary", null);
KpiController = __decorate([
    Controller('kpi'),
    __metadata("design:paramtypes", [typeof (_a = typeof KpiService !== "undefined" && KpiService) === "function" ? _a : Object])
], KpiController);
export { KpiController };
