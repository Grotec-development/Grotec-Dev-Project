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
var _a, _b, _c, _d, _e;
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { ApplyLeaveDto, CreateLeaveTypeDto, RejectLeaveDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';
let LeaveController = class LeaveController {
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
        return this.leave.getApplicationsMy(actor, parsePagination(page, pageSize), {
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
        const result = await this.leave.getApplications(actor, parsePagination(page, pageSize), {
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
__decorate([
    Get('types'),
    RequirePermission(PERMISSIONS.leaveRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getTypes", null);
__decorate([
    Post('types'),
    RequirePermission(PERMISSIONS.leaveApprove),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof CreateLeaveTypeDto !== "undefined" && CreateLeaveTypeDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "createType", null);
__decorate([
    Get('my/balances'),
    RequirePermission(PERMISSIONS.leaveRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getBalancesMy", null);
__decorate([
    Get('my/applications'),
    RequirePermission(PERMISSIONS.leaveRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('status')),
    __param(2, Query('leaveTypeId')),
    __param(3, Query('year')),
    __param(4, Query('page')),
    __param(5, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getApplicationsMy", null);
__decorate([
    Post('my/apply'),
    RequirePermission(PERMISSIONS.leaveApply),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof ApplyLeaveDto !== "undefined" && ApplyLeaveDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "applyMy", null);
__decorate([
    Get('balances'),
    RequirePermission(PERMISSIONS.leaveRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('employeeId')),
    __param(2, Query('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getBalances", null);
__decorate([
    Get('applications'),
    RequirePermission(PERMISSIONS.leaveRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('employeeId')),
    __param(2, Query('status')),
    __param(3, Query('leaveTypeId')),
    __param(4, Query('year')),
    __param(5, Query('format')),
    __param(6, Query('page')),
    __param(7, Query('pageSize')),
    __param(8, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "getApplications", null);
__decorate([
    Post('apply'),
    RequirePermission(PERMISSIONS.leaveApply),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof ApplyLeaveDto !== "undefined" && ApplyLeaveDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "apply", null);
__decorate([
    Post([':id/approve', 'applications/:id/approve']),
    RequirePermission(PERMISSIONS.leaveApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "approve", null);
__decorate([
    Post([':id/reject', 'applications/:id/reject']),
    RequirePermission(PERMISSIONS.leaveApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_e = typeof RejectLeaveDto !== "undefined" && RejectLeaveDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "reject", null);
LeaveController = __decorate([
    Controller('leave'),
    __metadata("design:paramtypes", [typeof (_a = typeof LeaveService !== "undefined" && LeaveService) === "function" ? _a : Object])
], LeaveController);
export { LeaveController };
