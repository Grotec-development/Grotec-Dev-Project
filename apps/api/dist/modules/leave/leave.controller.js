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
exports.LeaveController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const pagination_1 = require("../../common/utils/pagination");
const leave_dto_1 = require("./dto/leave.dto");
const leave_service_1 = require("./leave.service");
let LeaveController = class LeaveController {
    leave;
    constructor(leave) {
        this.leave = leave;
    }
    async getTypes() {
        return this.leave.getTypes();
    }
    async createType(dto) {
        return this.leave.createType(dto);
    }
    async getBalancesMy(actor, year) {
        return this.leave.getBalancesMy(actor, { year });
    }
    async getApplicationsMy(actor, status, leaveTypeId, year, page, pageSize) {
        return this.leave.getApplicationsMy(actor, (0, pagination_1.parsePagination)(page, pageSize), {
            status: status,
            leaveTypeId,
            year,
        });
    }
    async applyMy(actor, dto) {
        return this.leave.applyMy(actor, dto);
    }
    async getBalances(actor, employeeId, year) {
        return this.leave.getBalances(actor, { employeeId, year });
    }
    async getApplications(actor, employeeId, status, leaveTypeId, year, format, page, pageSize, res) {
        const result = await this.leave.getApplications(actor, (0, pagination_1.parsePagination)(page, pageSize), {
            employeeId,
            status: status,
            leaveTypeId,
            year,
            format,
        });
        if (format === 'csv' && typeof result === 'string') {
            res?.setHeader('Content-Type', 'text/csv');
            res?.setHeader('Content-Disposition', 'attachment; filename="leave_applications.csv"');
            return result;
        }
        return result;
    }
    async apply(actor, dto) {
        return this.leave.apply(actor, dto);
    }
    async approve(actor, id) {
        return this.leave.approve(actor, id);
    }
    async reject(actor, id, dto) {
        return this.leave.reject(actor, id, dto);
    }
};
exports.LeaveController = LeaveController;
__decorate([
    (0, common_1.Get)('types'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getTypes", null);
__decorate([
    (0, common_1.Post)('types'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveApprove),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [leave_dto_1.CreateLeaveTypeDto]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "createType", null);
__decorate([
    (0, common_1.Get)('my/balances'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getBalancesMy", null);
__decorate([
    (0, common_1.Get)('my/applications'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('leaveTypeId')),
    __param(3, (0, common_1.Query)('year')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getApplicationsMy", null);
__decorate([
    (0, common_1.Post)('my/apply'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveApply),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.ApplyLeaveDto]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "applyMy", null);
__decorate([
    (0, common_1.Get)('balances'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('employeeId')),
    __param(2, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getBalances", null);
__decorate([
    (0, common_1.Get)('applications'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('employeeId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('leaveTypeId')),
    __param(4, (0, common_1.Query)('year')),
    __param(5, (0, common_1.Query)('format')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __param(8, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getApplications", null);
__decorate([
    (0, common_1.Post)('apply'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveApply),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.ApplyLeaveDto]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "apply", null);
__decorate([
    (0, common_1.Post)([':id/approve', 'applications/:id/approve']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)([':id/reject', 'applications/:id/reject']),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.leaveApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.RejectLeaveDto]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "reject", null);
exports.LeaveController = LeaveController = __decorate([
    (0, common_1.Controller)('leave'),
    __metadata("design:paramtypes", [leave_service_1.LeaveService])
], LeaveController);
//# sourceMappingURL=leave.controller.js.map