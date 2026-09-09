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
var _a, _b;
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralsService } from './referrals.service';
/**
 * Referrals are append-only: create and read only. No update or delete endpoint
 * is exposed, by design — referral history must not be rewritten.
 */
let ReferralsController = class ReferralsController {
    constructor(referrals) {
        this.referrals = referrals;
    }
    async create(actor, dto) {
        return this.referrals.create(actor, dto);
    }
    async list(actor, customerId) {
        return this.referrals.listForCustomer(actor, customerId);
    }
    async byCustomer(actor, customerId) {
        return this.referrals.listForCustomer(actor, customerId);
    }
};
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.referralManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreateReferralDto !== "undefined" && CreateReferralDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], ReferralsController.prototype, "create", null);
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.referralRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReferralsController.prototype, "list", null);
__decorate([
    Get('customers/:customerId'),
    RequirePermission(PERMISSIONS.referralRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReferralsController.prototype, "byCustomer", null);
ReferralsController = __decorate([
    Controller('referrals'),
    __metadata("design:paramtypes", [typeof (_a = typeof ReferralsService !== "undefined" && ReferralsService) === "function" ? _a : Object])
], ReferralsController);
export { ReferralsController };
