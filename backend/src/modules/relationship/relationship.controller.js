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
var _a, _b, _c;
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AssignRelationshipDto, ReleaseRelationshipDto } from './dto/assign-relationship.dto';
import { RelationshipService } from './relationship.service';
let RelationshipController = class RelationshipController {
    constructor(relationship) {
        this.relationship = relationship;
    }
    async list(actor, rmId, q, unassigned) {
        return this.relationship.list(actor, { rmId, q, unassigned });
    }
    async holders(actor) {
        return this.relationship.holders(actor);
    }
    async assign(actor, customerId, dto) {
        return this.relationship.assign(actor, customerId, dto);
    }
    async release(actor, customerId, dto) {
        return this.relationship.release(actor, customerId, dto);
    }
};
__decorate([
    Get('customers'),
    RequirePermission(PERMISSIONS.relationshipRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('rmId')),
    __param(2, Query('q')),
    __param(3, Query('unassigned')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "list", null);
__decorate([
    Get('holders'),
    RequirePermission(PERMISSIONS.relationshipRead),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "holders", null);
__decorate([
    Post('customers/:customerId/assign'),
    RequirePermission(PERMISSIONS.relationshipManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('customerId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_b = typeof AssignRelationshipDto !== "undefined" && AssignRelationshipDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "assign", null);
__decorate([
    HttpCode(200),
    Post('customers/:customerId/release'),
    RequirePermission(PERMISSIONS.relationshipManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('customerId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof ReleaseRelationshipDto !== "undefined" && ReleaseRelationshipDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], RelationshipController.prototype, "release", null);
RelationshipController = __decorate([
    Controller('relationship'),
    __metadata("design:paramtypes", [typeof (_a = typeof RelationshipService !== "undefined" && RelationshipService) === "function" ? _a : Object])
], RelationshipController);
export { RelationshipController };
