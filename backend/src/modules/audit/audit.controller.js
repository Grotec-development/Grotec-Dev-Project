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
import { Controller, Get, Query } from '@nestjs/common';
import { isTopTier, PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parsePagination, toPage } from '../../common/utils/pagination';
let AuditController = class AuditController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(actor, entityType, entityId, actorId, action, from, to, page, pageSize) {
        if (!isTopTier(actor.roleCode)) {
            throw ApiError.forbidden('FOUNDER_ONLY', 'Only Founder can access audit logs (PRD §5.1.2)');
        }
        const where = {};
        if (entityType)
            where.entityType = entityType;
        if (entityId)
            where.entityId = entityId;
        if (actorId)
            where.actorId = actorId;
        if (action)
            where.action = action;
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from);
            if (to)
                where.createdAt.lte = new Date(to);
        }
        const pagination = parsePagination(page, pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.auditEvent.findMany({
                where,
                include: { actor: { select: { id: true, fullName: true, email: true } } },
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
            }),
            this.prisma.auditEvent.count({ where }),
        ]);
        return toPage(items, total, pagination);
    }
};
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.auditRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('entityType')),
    __param(2, Query('entityId')),
    __param(3, Query('actorId')),
    __param(4, Query('action')),
    __param(5, Query('from')),
    __param(6, Query('to')),
    __param(7, Query('page')),
    __param(8, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "list", null);
AuditController = __decorate([
    Controller('audit'),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], AuditController);
export { AuditController };
