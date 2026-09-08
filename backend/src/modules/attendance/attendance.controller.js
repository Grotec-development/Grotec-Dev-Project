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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, } from '@nestjs/common';
import { PERMISSIONS, } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto, CorrectAttendanceDto, CreateEsslDeviceDto, CreateEsslMappingDto, EsslWebhookDto, MarkAttendanceDto, RejectAttendanceDto, SyncEsslDto, } from './dto/attendance.dto';
let AttendanceController = class AttendanceController {
    constructor(attendance) {
        this.attendance = attendance;
    }
    async listMy(actor, month, from, to, status, source, page, pageSize) {
        return this.attendance.listMy(actor, parsePagination(page, pageSize), {
            month,
            from,
            to,
            status: status,
            source: source,
        });
    }
    async summaryMy(actor, month) {
        const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return this.attendance.getSummaryMy(actor, { month: targetMonth });
    }
    async markMy(actor, dto) {
        return this.attendance.markMy(actor, dto);
    }
    async list(actor, employeeId, month, from, to, status, approvalStatus, source, page, pageSize) {
        return this.attendance.list(actor, parsePagination(page, pageSize), {
            employeeId,
            month,
            from,
            to,
            status: status,
            approvalStatus: approvalStatus,
            source: source,
        });
    }
    async summary(actor, month, employeeId) {
        const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return this.attendance.getSummary(actor, { month: targetMonth, employeeId });
    }
    async roster(actor) {
        return this.attendance.getRoster(actor);
    }
    async mark(actor, dto) {
        return this.attendance.mark(actor, dto);
    }
    async bulkMark(actor, dto) {
        return this.attendance.bulkMark(actor, dto);
    }
    async correct(actor, id, dto) {
        return this.attendance.correct(actor, id, dto);
    }
    async approve(actor, id) {
        return this.attendance.approve(actor, id);
    }
    async reject(actor, id, dto) {
        return this.attendance.reject(actor, id, dto);
    }
    async esslWebhook(secret, dto) {
        return this.attendance.handleEsslWebhook(secret, dto);
    }
    async syncEssl(actor, dto) {
        return this.attendance.syncEssl(actor, dto);
    }
    async getDevices() {
        return this.attendance.getDevices();
    }
    async createDevice(dto) {
        return this.attendance.createDevice(dto);
    }
    async getMappings(deviceId) {
        return this.attendance.getMappings(deviceId);
    }
    async createMapping(dto) {
        return this.attendance.createMapping(dto);
    }
};
__decorate([
    Get('my'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('month')),
    __param(2, Query('from')),
    __param(3, Query('to')),
    __param(4, Query('status')),
    __param(5, Query('source')),
    __param(6, Query('page')),
    __param(7, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "listMy", null);
__decorate([
    Get('my/summary'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "summaryMy", null);
__decorate([
    Post('my/mark'),
    RequirePermission(PERMISSIONS.attendanceMark),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof MarkAttendanceDto !== "undefined" && MarkAttendanceDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "markMy", null);
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('employeeId')),
    __param(2, Query('month')),
    __param(3, Query('from')),
    __param(4, Query('to')),
    __param(5, Query('status')),
    __param(6, Query('approvalStatus')),
    __param(7, Query('source')),
    __param(8, Query('page')),
    __param(9, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "list", null);
__decorate([
    Get('summary'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('month')),
    __param(2, Query('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "summary", null);
__decorate([
    Get('roster'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "roster", null);
__decorate([
    Post('mark'),
    RequirePermission(PERMISSIONS.attendanceMark),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof MarkAttendanceDto !== "undefined" && MarkAttendanceDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "mark", null);
__decorate([
    Post('bulk'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof BulkAttendanceDto !== "undefined" && BulkAttendanceDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "bulkMark", null);
__decorate([
    Patch(':id/correct'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_e = typeof CorrectAttendanceDto !== "undefined" && CorrectAttendanceDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "correct", null);
__decorate([
    Post(':id/approve'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "approve", null);
__decorate([
    Post(':id/reject'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_f = typeof RejectAttendanceDto !== "undefined" && RejectAttendanceDto) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "reject", null);
__decorate([
    Public(),
    Post('essl/webhook'),
    __param(0, Headers('x-essl-secret')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_g = typeof EsslWebhookDto !== "undefined" && EsslWebhookDto) === "function" ? _g : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "esslWebhook", null);
__decorate([
    Post('essl/sync'),
    RequirePermission(PERMISSIONS.attendanceMark),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_h = typeof SyncEsslDto !== "undefined" && SyncEsslDto) === "function" ? _h : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "syncEssl", null);
__decorate([
    Get('essl/devices'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "getDevices", null);
__decorate([
    Post('essl/devices'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof CreateEsslDeviceDto !== "undefined" && CreateEsslDeviceDto) === "function" ? _j : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createDevice", null);
__decorate([
    Get('essl/mappings'),
    RequirePermission(PERMISSIONS.attendanceRead),
    __param(0, Query('deviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "getMappings", null);
__decorate([
    Post('essl/mappings'),
    RequirePermission(PERMISSIONS.attendanceApprove),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof CreateEsslMappingDto !== "undefined" && CreateEsslMappingDto) === "function" ? _k : Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createMapping", null);
AttendanceController = __decorate([
    Controller('attendance'),
    __metadata("design:paramtypes", [typeof (_a = typeof AttendanceService !== "undefined" && AttendanceService) === "function" ? _a : Object])
], AttendanceController);
export { AttendanceController };
