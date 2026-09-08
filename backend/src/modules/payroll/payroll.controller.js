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
import { Body, Controller, Get, Header, Param, Post, Query, Res, } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ApprovePayrollDto, CreateAdvanceDto, CreatePayrollRunDto, CreateSalaryRevisionDto, GeneratePayrollDto, } from './dto/payroll.dto';
import { PayrollService } from './payroll.service';
let PayrollController = class PayrollController {
    constructor(payroll) {
        this.payroll = payroll;
    }
    async listRuns(actor) {
        return this.payroll.listRuns(actor);
    }
    async createRun(actor, dto) {
        return this.payroll.createRun(actor, dto);
    }
    async getRun(actor, id) {
        return this.payroll.getRun(actor, id);
    }
    async generate(actor, dto, id) {
        const month = dto.month || id;
        return this.payroll.generate(actor, { ...dto, month: month });
    }
    async approve(actor, id, dto) {
        return this.payroll.approve(actor, id, dto);
    }
    async publish(actor, id) {
        return this.payroll.publish(actor, id);
    }
    async getPayslips(actor, employeeId) {
        return this.payroll.getPayslips(actor, employeeId);
    }
    async getPayslipPdf(actor, id) {
        return this.payroll.getPayslipPdf(actor, id);
    }
    async getPayslipDetail(actor, id) {
        return this.payroll.getPayslipDetail(actor, id);
    }
    async getSalaryRevisions(actor, employeeId) {
        return this.payroll.getSalaryRevisions(actor, employeeId);
    }
    async createSalaryRevision(actor, dto) {
        return this.payroll.createSalaryRevision(actor, dto);
    }
    async listAdvances(actor, employeeId, status) {
        return this.payroll.listAdvances(actor, { employeeId, status });
    }
    async createAdvance(actor, dto) {
        return this.payroll.createAdvance(actor, dto);
    }
    async getReports(actor, month, format, res) {
        const result = await this.payroll.getReports(actor, month, format);
        if (format === 'csv' && typeof result === 'string') {
            res?.setHeader('Content-Type', 'text/csv');
            res?.setHeader('Content-Disposition', `attachment; filename="payroll_report_${month || 'current'}.csv"`);
            return result;
        }
        return result;
    }
};
__decorate([
    Get('runs'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "listRuns", null);
__decorate([
    Post('runs'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreatePayrollRunDto !== "undefined" && CreatePayrollRunDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createRun", null);
__decorate([
    Get('runs/:id'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getRun", null);
__decorate([
    Post(['generate', 'runs/:id/generate']),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __param(2, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof GeneratePayrollDto !== "undefined" && GeneratePayrollDto) === "function" ? _c : Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "generate", null);
__decorate([
    Post([':id/approve', 'runs/:id/approve']),
    RequirePermission(PERMISSIONS.payrollApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_d = typeof ApprovePayrollDto !== "undefined" && ApprovePayrollDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "approve", null);
__decorate([
    Post([':id/publish', 'runs/:id/publish']),
    RequirePermission(PERMISSIONS.payrollApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "publish", null);
__decorate([
    Get('payslips'),
    RequirePermission(PERMISSIONS.payrollRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslips", null);
__decorate([
    Get('payslips/:id/pdf'),
    RequirePermission(PERMISSIONS.payrollRead),
    Header('Content-Type', 'text/html'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslipPdf", null);
__decorate([
    Get('payslips/:id'),
    RequirePermission(PERMISSIONS.payrollRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslipDetail", null);
__decorate([
    Get('salary-revisions/:employeeId'),
    RequirePermission(PERMISSIONS.payrollRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getSalaryRevisions", null);
__decorate([
    Post('salary-revisions'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_e = typeof CreateSalaryRevisionDto !== "undefined" && CreateSalaryRevisionDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createSalaryRevision", null);
__decorate([
    Get('advances'),
    RequirePermission(PERMISSIONS.payrollRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('employeeId')),
    __param(2, Query('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "listAdvances", null);
__decorate([
    Post('advances'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_f = typeof CreateAdvanceDto !== "undefined" && CreateAdvanceDto) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createAdvance", null);
__decorate([
    Get('reports'),
    RequirePermission(PERMISSIONS.payrollManage),
    __param(0, CurrentEmployee()),
    __param(1, Query('month')),
    __param(2, Query('format')),
    __param(3, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getReports", null);
PayrollController = __decorate([
    Controller('payroll'),
    __metadata("design:paramtypes", [typeof (_a = typeof PayrollService !== "undefined" && PayrollService) === "function" ? _a : Object])
], PayrollController);
export { PayrollController };
