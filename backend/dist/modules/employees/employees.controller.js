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
exports.EmployeesController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const pagination_1 = require("../../common/utils/pagination");
const create_employee_dto_1 = require("./dto/create-employee.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
const update_employee_dto_1 = require("./dto/update-employee.dto");
const create_employee_note_dto_1 = require("./dto/create-employee-note.dto");
const create_employee_document_dto_1 = require("./dto/create-employee-document.dto");
const create_employee_history_dto_1 = require("./dto/create-employee-history.dto");
const assign_staff_dto_1 = require("./dto/assign-staff.dto");
const employees_service_1 = require("./employees.service");
let EmployeesController = class EmployeesController {
    employees;
    constructor(employees) {
        this.employees = employees;
    }
    async list(actor, q, status, roleCode, department, designation, employmentStatus, sort, page, pageSize) {
        return this.employees.list(actor, (0, pagination_1.parsePagination)(page, pageSize), {
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
exports.EmployeesController = EmployeesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('roleCode')),
    __param(4, (0, common_1.Query)('department')),
    __param(5, (0, common_1.Query)('designation')),
    __param(6, (0, common_1.Query)('employmentStatus')),
    __param(7, (0, common_1.Query)('sort')),
    __param(8, (0, common_1.Query)('page')),
    __param(9, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeCreate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_employee_dto_1.CreateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/profile'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Get)(':id/profile/performance'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfilePerformance", null);
__decorate([
    (0, common_1.Get)(':id/profile/attendance'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileAttendance", null);
__decorate([
    (0, common_1.Get)(':id/profile/leave'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileLeave", null);
__decorate([
    (0, common_1.Get)(':id/profile/salary'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileSalary", null);
__decorate([
    (0, common_1.Get)(':id/profile/advances'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileAdvances", null);
__decorate([
    (0, common_1.Get)(':id/profile/history'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileHistory", null);
__decorate([
    (0, common_1.Get)(':id/profile/documents'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getProfileDocuments", null);
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_employee_document_dto_1.CreateEmployeeDocumentDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "addDocument", null);
__decorate([
    (0, common_1.Delete)(':id/documents/:docId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_employee_note_dto_1.CreateEmployeeNoteDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "createNote", null);
__decorate([
    (0, common_1.Get)(':id/notes'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "listNotes", null);
__decorate([
    (0, common_1.Post)(':id/history'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_employee_history_dto_1.CreateEmployeeHistoryDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "addHistory", null);
__decorate([
    (0, common_1.Post)(':id/assignments'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_staff_dto_1.AssignStaffDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "assignStaff", null);
__decorate([
    (0, common_1.Delete)(':id/assignments/:staffId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "unassignStaff", null);
__decorate([
    (0, common_1.Get)(':id/assignments'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "listAssignments", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_employee_dto_1.UpdateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)(':id/activate'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeDeactivate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "activate", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)(':id/deactivate'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeDeactivate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "deactivate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)(':id/reset-password'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeResetPassword),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "resetPassword", null);
exports.EmployeesController = EmployeesController = __decorate([
    (0, common_1.Controller)('employees'),
    __metadata("design:paramtypes", [employees_service_1.EmployeesService])
], EmployeesController);
//# sourceMappingURL=employees.controller.js.map