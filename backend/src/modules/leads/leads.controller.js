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
var _a, _b, _c, _d, _e;
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { RebalanceLeadsDto } from './dto/rebalance-leads.dto';
import { LeadsService } from './leads.service';
let LeadsController = class LeadsController {
    constructor(leads) {
        this.leads = leads;
    }
    async list(actor, status, ownerId, q, page, pageSize) {
        return this.leads.list(actor, parsePagination(page, pageSize), {
            status: status,
            ownerId,
            q,
        });
    }
    async create(actor, dto) {
        return this.leads.create(actor, dto);
    }
    async detail(actor, id) {
        return this.leads.detailOrThrow(id, actor);
    }
    async update(actor, id, dto) {
        return this.leads.update(actor, id, dto);
    }
    async ownershipHistory(actor, id) {
        return this.leads.ownershipHistory(id, actor);
    }
    async assign(actor, id, dto) {
        return this.leads.assign(actor, id, dto);
    }
    async rebalance(actor, dto) {
        return this.leads.rebalanceWorkload(actor, dto);
    }
};
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.leadRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('status')),
    __param(2, Query('ownerId')),
    __param(3, Query('q')),
    __param(4, Query('page')),
    __param(5, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "list", null);
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.leadCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof CreateLeadDto !== "undefined" && CreateLeadDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "create", null);
__decorate([
    Get(':id'),
    RequirePermission(PERMISSIONS.leadRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "detail", null);
__decorate([
    Patch(':id'),
    RequirePermission(PERMISSIONS.leadUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof UpdateLeadDto !== "undefined" && UpdateLeadDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "update", null);
__decorate([
    Get(':id/ownership-history'),
    RequirePermission(PERMISSIONS.leadRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "ownershipHistory", null);
__decorate([
    Post(':id/assign'),
    RequirePermission(PERMISSIONS.leadAssign),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_d = typeof AssignLeadDto !== "undefined" && AssignLeadDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "assign", null);
__decorate([
    Post('rebalance'),
    RequirePermission(PERMISSIONS.leadAssign),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_e = typeof RebalanceLeadsDto !== "undefined" && RebalanceLeadsDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "rebalance", null);
LeadsController = __decorate([
    Controller('leads'),
    __metadata("design:paramtypes", [typeof (_a = typeof LeadsService !== "undefined" && LeadsService) === "function" ? _a : Object])
], LeadsController);
export { LeadsController };
