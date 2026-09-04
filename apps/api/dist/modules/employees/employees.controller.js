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
const employees_service_1 = require("./employees.service");
let EmployeesController = class EmployeesController {
    employees;
    constructor(employees) {
        this.employees = employees;
    }
    async list(q, status, roleCode, page, pageSize) {
        return this.employees.list((0, pagination_1.parsePagination)(page, pageSize), { q, status: status, roleCode });
    }
    async create(actor, dto) {
        return this.employees.create(actor, dto);
    }
    async get(id) {
        return this.employees.get(id);
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
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('roleCode')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
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
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "get", null);
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