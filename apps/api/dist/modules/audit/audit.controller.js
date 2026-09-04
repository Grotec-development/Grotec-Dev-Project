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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const pagination_1 = require("../../common/utils/pagination");
let AuditController = class AuditController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(entityType, entityId, actorId, action, from, to, page, pageSize) {
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
        const pagination = (0, pagination_1.parsePagination)(page, pageSize);
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
        return (0, pagination_1.toPage)(items, total, pagination);
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.auditRead),
    __param(0, (0, common_1.Query)('entityType')),
    __param(1, (0, common_1.Query)('entityId')),
    __param(2, (0, common_1.Query)('actorId')),
    __param(3, (0, common_1.Query)('action')),
    __param(4, (0, common_1.Query)('from')),
    __param(5, (0, common_1.Query)('to')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "list", null);
exports.AuditController = AuditController = __decorate([
    (0, common_1.Controller)('audit'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map