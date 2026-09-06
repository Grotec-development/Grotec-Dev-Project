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
exports.CropsController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const crops_service_1 = require("./crops.service");
const create_crop_dto_1 = require("./dto/create-crop.dto");
const update_crop_dto_1 = require("./dto/update-crop.dto");
let CropsController = class CropsController {
    crops;
    constructor(crops) {
        this.crops = crops;
    }
    async list(actor, includeInactive) {
        return this.crops.list(includeInactive === 'true', actor);
    }
    async create(actor, dto) {
        return this.crops.create(actor, dto);
    }
    async update(actor, id, dto) {
        return this.crops.update(actor, id, dto);
    }
};
exports.CropsController = CropsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.cropRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.cropManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_crop_dto_1.CreateCropDto]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.cropManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_crop_dto_1.UpdateCropDto]),
    __metadata("design:returntype", Promise)
], CropsController.prototype, "update", null);
exports.CropsController = CropsController = __decorate([
    (0, common_1.Controller)('crops'),
    __metadata("design:paramtypes", [crops_service_1.CropsService])
], CropsController);
//# sourceMappingURL=crops.controller.js.map