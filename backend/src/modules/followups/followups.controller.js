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
var _a;
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { FollowUpsService } from './followups.service';
let FollowUpsController = class FollowUpsController {
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
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('customerId')),
    __param(2, Query('status')),
    __param(3, Query('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], FollowUpsController.prototype, "list", null);
__decorate([
    Post(':id/complete'),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FollowUpsController.prototype, "complete", null);
FollowUpsController = __decorate([
    Controller('follow-ups'),
    __metadata("design:paramtypes", [typeof (_a = typeof FollowUpsService !== "undefined" && FollowUpsService) === "function" ? _a : Object])
], FollowUpsController);
export { FollowUpsController };
