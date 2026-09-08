var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, FollowUpStatus } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
let FollowUpsService = class FollowUpsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(actor, filters = {}) {
        // Agents see the callbacks they scheduled; Manager/Founder see everything
        // (optionally filtered). Record scope mirrors the calls/queue model.
        const agentScope = actor.roleCode === 'AGENT' ? actor.id : undefined;
        const ownerScope = agentScope ?? (actor.roleCode === 'AGENT' ? undefined : filters.ownerId);
        const rows = await this.prisma.followUp.findMany({
            where: {
                ...(ownerScope ? { agentId: ownerScope } : {}),
                ...(filters.customerId ? { customerId: filters.customerId } : {}),
                ...(filters.status ? { status: filters.status } : {}),
            },
            include: {
                agent: { select: { id: true, fullName: true } },
                customer: { select: { id: true, fullName: true, farmerCode: true } },
            },
            orderBy: [{ dueAt: 'asc' }],
            take: 100,
        });
        return rows.map((row) => this.serialize(row));
    }
    async complete(actor, id) {
        const followUp = await this.prisma.followUp.findUnique({ where: { id } });
        if (!followUp || (actor.roleCode === 'AGENT' && followUp.agentId !== actor.id)) {
            throw ApiError.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        }
        if (followUp.status !== FollowUpStatus.PENDING) {
            throw ApiError.conflict('FOLLOW_UP_NOT_PENDING', 'Only pending follow-ups can be completed');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.followUp.update({
                where: { id },
                data: { status: FollowUpStatus.COMPLETED, completedAt: new Date() },
                include: { agent: { select: { id: true, fullName: true } }, customer: { select: { id: true, fullName: true, farmerCode: true } } },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: AuditEntityType.FOLLOW_UP,
                entityId: id,
                entityLabel: row.customer.fullName,
                action: AuditAction.FOLLOW_UP_COMPLETED,
                after: { completedAt: new Date().toISOString() },
            });
            return row;
        });
        return this.serialize(updated);
    }
    serialize(row) {
        return {
            id: row.id,
            dueAt: row.dueAt,
            note: row.note,
            status: row.status,
            completedAt: row.completedAt,
            agent: row.agent,
            customer: row.customer,
        };
    }
};
FollowUpsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], FollowUpsService);
export { FollowUpsService };
