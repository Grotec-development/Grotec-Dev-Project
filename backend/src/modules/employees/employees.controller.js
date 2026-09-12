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
var _a, _b, _c, _d, _e, _f, _g, _h;
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeNoteDto } from './dto/create-employee-note.dto';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';
import { CreateEmployeeHistoryDto } from './dto/create-employee-history.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { EmployeesService } from './employees.service';
let EmployeesController = class EmployeesController {
    constructor(employees) {
        this.employees = employees;
    }
    async list(actor, q, status, roleCode, department, designation, employmentStatus, sort, page, pageSize) {
        return this.employees.list(actor, parsePagination(page, pageSize), {
            q,
            status: status,
            roleCode,
            department,
            designation,
            employmentStatus: employmentStatus,
            sort,
        });
    }
    async create(actor, dto) {
        return this.employees.create(actor, dto);
    }
    async listRoles(actor) {
        return this.employees.listRoles(actor);
    }
    async get(actor, id) {
        return this.employees.get(actor, id);
    }
    async getProfile(actor, id) {
        return this.employees.getProfile(actor, id);
    }
    async getProfilePerformance(actor, id) {
        return this.employees.getProfilePerformance(actor, id);
    }
    async getProfileAttendance(actor, id) {
        return this.employees.getProfileAttendance(actor, id);
    }
    async getProfileLeave(actor, id) {
        return this.employees.getProfileLeave(actor, id);
    }
    async getProfileSalary(actor, id) {
        return this.employees.getProfileSalary(actor, id);
    }
    async getProfileAdvances(actor, id) {
        return this.employees.getProfileAdvances(actor, id);
    }
    async getProfileHistory(actor, id) {
        return this.employees.getProfileHistory(actor, id);
    }
    async getProfileDocuments(actor, id) {
        return this.employees.getProfileDocuments(actor, id);
    }
    async addDocument(actor, id, body) {
        return this.employees.addDocument(actor, id, body);
    }
    async deleteDocument(actor, id, docId) {
        return this.employees.deleteDocument(actor, id, docId);
    }
    async createNote(actor, id, dto) {
        return this.employees.createNote(actor, id, dto);
    }
    async listNotes(actor, id) {
        return this.employees.listNotes(actor, id);
    }
    async addHistory(actor, id, dto) {
        return this.employees.addHistory(actor, id, dto);
    }
    async assignStaff(actor, id, dto) {
        return this.employees.assignStaff(actor, id, dto.staffEmployeeId);
    }
    async unassignStaff(actor, id, staffId) {
        return this.employees.unassignStaff(actor, id, staffId);
    }
    async listAssignments(actor, id) {
        return this.employees.listAssignments(actor, id);
    }
    async update(actor, id, dto) {
        return this.employees.update(actor, id, dto);
    }
    async activate(actor, id) {
        await this.employees.setActive(actor, id, true);
    }
    async deactivate(actor, id) {
        await this.employees.setActive(actor, id, false);
    }
    async resetPassword(actor, id, dto) {
        return this.employees.resetPassword(actor, id, dto);
    }
};
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.employeeRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('q')),
    __param(2, Query('status')),
    __param(3, Query('roleCode')),
    __param(4, Query('department')),
    __param(5, Query('designation')),
    __param(6, Query('employmentStatus')),
    __param(7, Query('sort')),
    __param(8, Query('page')),
    __param(9, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "list", null);
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.employeeCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreateEmployeeDto !== "undefined" && CreateEmployeeDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "create", null);
__decorate([
    Get('roles'),
    // Gated on employeeCreate rather than roleRead: this endpoint exists to
    // populate the role dropdown on employee create/update, and MANAGER (who
    // creates employees) doesn't hold roleRead in the matrix — it previously
    // got a role list "for free" as a side effect of deriving it from the
    // employee list it already had, which employeeCreate-gating preserves.
    RequirePermission(PERMISSIONS.employeeCreate),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "listRoles", null);
__decorate([
    Get(':id'),
    RequirePermission(PERMISSIONS.employeeRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "get", null);
__decorate([
    Get(':id/profile'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfile", null);
__decorate([
    Get(':id/profile/performance'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfilePerformance", null);
__decorate([
    Get(':id/profile/attendance'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileAttendance", null);
__decorate([
    Get(':id/profile/leave'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileLeave", null);
__decorate([
    Get(':id/profile/salary'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileSalary", null);
__decorate([
    Get(':id/profile/advances'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileAdvances", null);
__decorate([
    Get(':id/profile/history'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileHistory", null);
__decorate([
    Get(':id/profile/documents'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileDocuments", null);
__decorate([
    Post(':id/documents'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof CreateEmployeeDocumentDto !== "undefined" && CreateEmployeeDocumentDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "addDocument", null);
__decorate([
    Delete(':id/documents/:docId'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('docId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "deleteDocument", null);
__decorate([
    Post(':id/notes'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_d = typeof CreateEmployeeNoteDto !== "undefined" && CreateEmployeeNoteDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "createNote", null);
__decorate([
    Get(':id/notes'),
    RequirePermission(PERMISSIONS.employeeRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "listNotes", null);
__decorate([
    Post(':id/history'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_e = typeof CreateEmployeeHistoryDto !== "undefined" && CreateEmployeeHistoryDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "addHistory", null);
__decorate([
    Post(':id/assignments'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_f = typeof AssignStaffDto !== "undefined" && AssignStaffDto) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "assignStaff", null);
__decorate([
    Delete(':id/assignments/:staffId'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Param('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "unassignStaff", null);
__decorate([
    Get(':id/assignments'),
    RequirePermission(PERMISSIONS.employeeRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "listAssignments", null);
__decorate([
    Patch(':id'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_g = typeof UpdateEmployeeDto !== "undefined" && UpdateEmployeeDto) === "function" ? _g : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "update", null);
__decorate([
    HttpCode(204),
    Post(':id/activate'),
    RequirePermission(PERMISSIONS.employeeDeactivate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "activate", null);
__decorate([
    HttpCode(204),
    Post(':id/deactivate'),
    RequirePermission(PERMISSIONS.employeeDeactivate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "deactivate", null);
__decorate([
    HttpCode(200),
    Post(':id/reset-password'),
    RequirePermission(PERMISSIONS.employeeResetPassword),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_h = typeof ResetPasswordDto !== "undefined" && ResetPasswordDto) === "function" ? _h : Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "resetPassword", null);
EmployeesController = __decorate([
    Controller('employees'),
    __metadata("design:paramtypes", [typeof (_a = typeof EmployeesService !== "undefined" && EmployeesService) === "function" ? _a : Object])
], EmployeesController);
export { EmployeesController };
