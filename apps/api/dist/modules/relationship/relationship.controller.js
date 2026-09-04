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
exports.RelationshipController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const assign_relationship_dto_1 = require("./dto/assign-relationship.dto");
const relationship_service_1 = require("./relationship.service");
let RelationshipController = class RelationshipController {
    relationship;
    constructor(relationship) {
        this.relationship = relationship;
    }
    async list(actor, rmId, q, unassigned) {
        return this.relationship.list(actor, { rmId, q, unassigned });
    }
    async holders() {
        return this.relationship.holders();
    }
    async assign(actor, customerId, dto) {
        return this.relationship.assign(actor, customerId, dto);
    }
    async release(actor, customerId, dto) {
        return this.relationship.release(actor, customerId, dto);
    }
};
exports.RelationshipController = RelationshipController;
__decorate([
    (0, common_1.Get)('customers'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.relationshipRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('rmId')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('unassigned')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('holders'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.relationshipRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "holders", null);
__decorate([
    (0, common_1.Post)('customers/:customerId/assign'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.relationshipManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('customerId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_relationship_dto_1.AssignRelationshipDto]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "assign", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('customers/:customerId/release'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.relationshipManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('customerId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_relationship_dto_1.ReleaseRelationshipDto]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "release", null);
exports.RelationshipController = RelationshipController = __decorate([
    (0, common_1.Controller)('relationship'),
    __metadata("design:paramtypes", [relationship_service_1.RelationshipService])
], RelationshipController);
//# sourceMappingURL=relationship.controller.js.map