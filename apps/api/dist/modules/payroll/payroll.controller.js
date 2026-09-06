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
exports.PayrollController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const payroll_dto_1 = require("./dto/payroll.dto");
const payroll_service_1 = require("./payroll.service");
let PayrollController = class PayrollController {
    payroll;
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
exports.PayrollController = PayrollController;
__decorate([
    (0, common_1.Get)('runs'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "listRuns", null);
__decorate([
    (0, common_1.Post)('runs'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payroll_dto_1.CreatePayrollRunDto]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createRun", null);
__decorate([
    (0, common_1.Get)('runs/:id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getRun", null);
__decorate([
    (0, common_1.Post)(['generate', 'runs/:id/generate']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payroll_dto_1.GeneratePayrollDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)([':id/approve', 'runs/:id/approve']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, payroll_dto_1.ApprovePayrollDto]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)([':id/publish', 'runs/:id/publish']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('payslips'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslips", null);
__decorate([
    (0, common_1.Get)('payslips/:id/pdf'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollRead),
    (0, common_1.Header)('Content-Type', 'text/html'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslipPdf", null);
__decorate([
    (0, common_1.Get)('payslips/:id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getPayslipDetail", null);
__decorate([
    (0, common_1.Get)('salary-revisions/:employeeId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getSalaryRevisions", null);
__decorate([
    (0, common_1.Post)('salary-revisions'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payroll_dto_1.CreateSalaryRevisionDto]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createSalaryRevision", null);
__decorate([
    (0, common_1.Get)('advances'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('employeeId')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "listAdvances", null);
__decorate([
    (0, common_1.Post)('advances'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payroll_dto_1.CreateAdvanceDto]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createAdvance", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.payrollManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "getReports", null);
exports.PayrollController = PayrollController = __decorate([
    (0, common_1.Controller)('payroll'),
    __metadata("design:paramtypes", [payroll_service_1.PayrollService])
], PayrollController);
//# sourceMappingURL=payroll.controller.js.map