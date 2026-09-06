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
exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const pagination_1 = require("../../common/utils/pagination");
const customers_service_1 = require("./customers.service");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const update_customer_dto_1 = require("./dto/update-customer.dto");
const add_phone_dto_1 = require("./dto/add-phone.dto");
const add_note_dto_1 = require("./dto/add-note.dto");
const update_phone_dto_1 = require("./dto/update-phone.dto");
const customer_input_dto_1 = require("./dto/customer-input.dto");
const update_location_dto_1 = require("./dto/update-location.dto");
const update_crop_dto_1 = require("./dto/update-crop.dto");
const customer_input_dto_2 = require("./dto/customer-input.dto");
let CustomersController = class CustomersController {
    customers;
    constructor(customers) {
        this.customers = customers;
    }
    async list(actor, q, phone, status, cropId, ownerId, page, pageSize) {
        return this.customers.list(actor, (0, pagination_1.parsePagination)(page, pageSize), {
            q,
            phone,
            status: status,
            cropId,
            ownerId,
        });
    }
    async lookupByPhone(phone) {
        return this.customers.lookupByPhone(phone);
    }
    async create(actor, dto) {
        return this.customers.create(actor, dto);
    }
    async detail(actor, id) {
        return this.customers.detailOrThrow(id, actor);
    }
    async update(actor, id, dto) {
        return this.customers.update(actor, id, dto.fullName);
    }
    async activate(actor, id) {
        await this.customers.setActive(actor, id, true);
    }
    async deactivate(actor, id) {
        await this.customers.setActive(actor, id, false);
    }
    async addPhone(actor, id, dto) {
        return this.customers.addPhone(actor, id, dto);
    }
    async updatePhone(actor, id, phoneId, dto) {
        return this.customers.updatePhone(actor, id, phoneId, dto);
    }
    async removePhone(actor, id, phoneId) {
        await this.customers.removePhone(actor, id, phoneId);
    }
    async addLocation(actor, id, dto) {
        return this.customers.addLocation(actor, id, dto);
    }
    async updateLocation(actor, id, locationId, dto) {
        return this.customers.updateLocation(actor, id, locationId, dto);
    }
    async removeLocation(actor, id, locationId) {
        await this.customers.removeLocation(actor, id, locationId);
    }
    async addCrop(actor, id, dto) {
        return this.customers.addCrop(actor, id, dto);
    }
    async updateCrop(actor, id, customerCropId, dto) {
        return this.customers.updateCrop(actor, id, customerCropId, dto);
    }
    async removeCrop(actor, id, customerCropId) {
        await this.customers.removeCrop(actor, id, customerCropId);
    }
    async listNotes(actor, id) {
        return this.customers.listNotes(id, actor);
    }
    async addNote(actor, id, dto) {
        return this.customers.addNote(id, actor, dto.body);
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('phone')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('cropId')),
    __param(5, (0, common_1.Query)('ownerId')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('lookup'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerRead),
    __param(0, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "lookupByPhone", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerCreate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_customer_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_customer_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)(':id/activate'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerDeactivate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "activate", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)(':id/deactivate'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerDeactivate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':id/phones'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_phone_dto_1.AddPhoneDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addPhone", null);
__decorate([
    (0, common_1.Patch)(':id/phones/:phoneId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('phoneId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_phone_dto_1.UpdatePhoneDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updatePhone", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)(':id/phones/:phoneId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('phoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removePhone", null);
__decorate([
    (0, common_1.Post)(':id/locations'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customer_input_dto_2.LocationInputDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addLocation", null);
__decorate([
    (0, common_1.Patch)(':id/locations/:locationId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('locationId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)(':id/locations/:locationId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removeLocation", null);
__decorate([
    (0, common_1.Post)(':id/crops'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customer_input_dto_1.CropInputDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addCrop", null);
__decorate([
    (0, common_1.Patch)(':id/crops/:customerCropId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('customerCropId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_crop_dto_1.UpdateCustomerCropDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateCrop", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)(':id/crops/:customerCropId'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('customerCropId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "removeCrop", null);
__decorate([
    (0, common_1.Get)(':id/notes'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "listNotes", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.customerUpdate),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_note_dto_1.AddCustomerNoteDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "addNote", null);
exports.CustomersController = CustomersController = __decorate([
    (0, common_1.Controller)('customers'),
    __metadata("design:paramtypes", [customers_service_1.CustomersService])
], CustomersController);
//# sourceMappingURL=customers.controller.js.map