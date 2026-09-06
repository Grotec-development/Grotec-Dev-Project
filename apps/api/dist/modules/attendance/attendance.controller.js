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
exports.AttendanceController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const pagination_1 = require("../../common/utils/pagination");
const attendance_service_1 = require("./attendance.service");
const attendance_dto_1 = require("./dto/attendance.dto");
let AttendanceController = class AttendanceController {
    attendance;
    constructor(attendance) {
        this.attendance = attendance;
    }
    async listMy(actor, month, from, to, status, source, page, pageSize) {
        return this.attendance.listMy(actor, (0, pagination_1.parsePagination)(page, pageSize), {
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
        return this.attendance.list(actor, (0, pagination_1.parsePagination)(page, pageSize), {
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
exports.AttendanceController = AttendanceController;
__decorate([
    (0, common_1.Get)('my'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('status')),
    __param(5, (0, common_1.Query)('source')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "listMy", null);
__decorate([
    (0, common_1.Get)('my/summary'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "summaryMy", null);
__decorate([
    (0, common_1.Post)('my/mark'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceMark),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.MarkAttendanceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "markMy", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('employeeId')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('status')),
    __param(6, (0, common_1.Query)('approvalStatus')),
    __param(7, (0, common_1.Query)('source')),
    __param(8, (0, common_1.Query)('page')),
    __param(9, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('roster'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "roster", null);
__decorate([
    (0, common_1.Post)('mark'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceMark),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.MarkAttendanceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "mark", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.BulkAttendanceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "bulkMark", null);
__decorate([
    (0, common_1.Patch)(':id/correct'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attendance_dto_1.CorrectAttendanceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "correct", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attendance_dto_1.RejectAttendanceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "reject", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('essl/webhook'),
    __param(0, (0, common_1.Headers)('x-essl-secret')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.EsslWebhookDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "esslWebhook", null);
__decorate([
    (0, common_1.Post)('essl/sync'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceMark),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.SyncEsslDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "syncEssl", null);
__decorate([
    (0, common_1.Get)('essl/devices'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "getDevices", null);
__decorate([
    (0, common_1.Post)('essl/devices'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attendance_dto_1.CreateEsslDeviceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createDevice", null);
__decorate([
    (0, common_1.Get)('essl/mappings'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceRead),
    __param(0, (0, common_1.Query)('deviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "getMappings", null);
__decorate([
    (0, common_1.Post)('essl/mappings'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.attendanceApprove),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attendance_dto_1.CreateEsslMappingDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createMapping", null);
exports.AttendanceController = AttendanceController = __decorate([
    (0, common_1.Controller)('attendance'),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceController);
//# sourceMappingURL=attendance.controller.js.map