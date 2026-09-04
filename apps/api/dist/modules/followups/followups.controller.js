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
exports.FollowUpsController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const followups_service_1 = require("./followups.service");
let FollowUpsController = class FollowUpsController {
    followUps;
    constructor(followUps) {
        this.followUps = followUps;
    }
    async list(actor, customerId, status, ownerId) {
        return this.followUps.list(actor, {
            customerId,
            status: status,
            ownerId,
        });
    }
    async complete(actor, id) {
        return this.followUps.complete(actor, id);
    }
};
exports.FollowUpsController = FollowUpsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('customerId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], FollowUpsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FollowUpsController.prototype, "complete", null);
exports.FollowUpsController = FollowUpsController = __decorate([
    (0, common_1.Controller)('follow-ups'),
    __metadata("design:paramtypes", [followups_service_1.FollowUpsService])
], FollowUpsController);
//# sourceMappingURL=followups.controller.js.map