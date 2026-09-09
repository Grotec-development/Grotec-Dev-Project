var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntityType, CustomerStatus } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
/**
 * Customer referrals (Step 3B).
 *
 * Append-only: a referral is created and never updated or deleted. The referred
 * customer is NOT stored — it is derived through lead.customerId, so the two can
 * never disagree.
 *
 * Authorization reuses the existing mechanisms rather than reimplementing them:
 *   - CustomersService.assertVisible() for the referrer customer (403 scope)
 *   - LeadsService.detailOrThrow()    for the lead (agent ownership scope)
 */
let ReferralsService = class ReferralsService {
    constructor(prisma, audit, customers, leads) {
        this.prisma = prisma;
        this.audit = audit;
        this.customers = customers;
        this.leads = leads;
    }
    async create(actor, dto) {
        // 1. The actor must be able to see the referrer customer (existing scope).
        await this.customers.assertVisible(dto.referrerCustomerId, actor);
        // 2. ...and the lead (existing agent-ownership scope; throws 404 when out of scope).
        await this.leads.detailOrThrow(dto.leadId, actor);
        // 3. Referrer must be an active, non-deleted customer.
        const referrer = await this.prisma.customer.findFirst({
            where: { id: dto.referrerCustomerId, deletedAt: null },
        });
        if (!referrer)
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Referring customer not found');
        if (referrer.status !== CustomerStatus.ACTIVE) {
            throw ApiError.badRequest('REFERRER_INACTIVE', 'An inactive customer cannot be recorded as a referrer');
        }
        // 4. Resolve the lead and derive the referred customer from it.
        const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, deletedAt: null } });
        if (!lead)
            throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        // 5. Self-referral: the referrer cannot be the lead's own customer.
        if (lead.customerId === referrer.id) {
            throw ApiError.badRequest('SELF_REFERRAL', 'A customer cannot refer their own lead');
        }
        const notes = dto.notes?.trim() ? dto.notes.trim() : null;
        let created;
        try {
            created = await this.prisma.$transaction(async (tx) => {
                const row = await tx.referral.create({
                    data: {
                        referrerCustomerId: referrer.id,
                        leadId: lead.id,
                        notes,
                        createdById: actor.id,
                    },
                });
                await this.audit.record(tx, {
                    actorId: actor.id,
                    entityType: AuditEntityType.REFERRAL,
                    entityId: row.id,
                    entityLabel: referrer.fullName,
                    action: AuditAction.REFERRAL_CREATED,
                    after: {
                        referrerCustomerId: referrer.id,
                        leadId: lead.id,
                        referredCustomerId: lead.customerId,
                        hasNotes: notes !== null,
                    },
                });
                return row;
            });
        }
        catch (error) {
            // The database unique index is the real duplicate guard: two concurrent
            // requests cannot both insert (same referrer, same lead).
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw ApiError.conflict('REFERRAL_EXISTS', 'This customer has already referred this lead');
            }
            throw error;
        }
        return this.detail(created.id);
    }
    /** Referrals made BY one customer. Scope is checked against the referrer. */
    async listForCustomer(actor, customerId) {
        await this.customers.assertVisible(customerId, actor);
        const rows = await this.prisma.referral.findMany({
            where: { referrerCustomerId: customerId },
            include: REFERRAL_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        return rows.map(serializeReferral);
    }
    async detail(id) {
        const row = await this.prisma.referral.findUnique({ where: { id }, include: REFERRAL_INCLUDE });
        if (!row)
            throw ApiError.notFound('REFERRAL_NOT_FOUND', 'Referral not found');
        return serializeReferral(row);
    }
};
ReferralsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof CustomersService !== "undefined" && CustomersService) === "function" ? _c : Object, typeof (_d = typeof LeadsService !== "undefined" && LeadsService) === "function" ? _d : Object])
], ReferralsService);
export { ReferralsService };
const REFERRAL_INCLUDE = {
    referrerCustomer: { select: { id: true, fullName: true, farmerCode: true } },
    lead: { select: { id: true, status: true, customer: { select: { id: true, fullName: true, farmerCode: true } } } },
    createdBy: { select: { id: true, fullName: true } },
};
/** The referred customer is projected from the lead — never stored on the referral. */
function serializeReferral(row) {
    return {
        id: row.id,
        referrerCustomer: row.referrerCustomer,
        leadId: row.leadId,
        leadStatus: row.lead.status,
        referredCustomer: row.lead.customer,
        notes: row.notes,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
    };
}
