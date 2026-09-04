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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@grotec/shared");
const shared_2 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const customers_service_1 = require("../customers/customers.service");
const messaging_service_1 = require("../messaging/messaging.service");
const dialer_registry_1 = require("./dialer/dialer.registry");
let CallsService = class CallsService {
    prisma;
    audit;
    dialers;
    customers;
    messaging;
    config;
    logger = new common_1.Logger('CallsService');
    constructor(prisma, audit, dialers, customers, messaging, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.dialers = dialers;
        this.customers = customers;
        this.messaging = messaging;
        this.config = config;
    }
    async placeCall(actor, dto) {
        const e164 = (0, shared_2.normalizePhoneToE164)(dto.phoneNumber);
        if (!e164) {
            throw api_error_1.ApiError.badRequest('INVALID_PHONE', `Phone number could not be normalized: "${dto.phoneNumber}"`);
        }
        const active = await this.prisma.call.findFirst({
            where: { agentId: actor.id, status: { in: [...shared_1.ACTIVE_CALL_STATUSES] } },
        });
        if (active) {
            throw api_error_1.ApiError.conflict('ACTIVE_CALL_EXISTS', 'You already have an active call on this workspace', { callId: active.id });
        }
        let customerId = null;
        if (dto.customerId) {
            const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
            if (!customer)
                throw api_error_1.ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
            customerId = dto.customerId;
        }
        else {
            const match = await this.prisma.customerPhone.findFirst({
                where: { phoneE164: e164, deletedAt: null, customer: { deletedAt: null } },
            });
            customerId = match?.customerId ?? null;
        }
        let leadId = dto.leadId ?? null;
        if (dto.leadId) {
            const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, deletedAt: null } });
            if (!lead)
                throw api_error_1.ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
        }
        else if (customerId) {
            const current = await this.prisma.lead.findFirst({
                where: { customerId, deletedAt: null, status: 'OPEN' },
                orderBy: { createdAt: 'desc' },
            });
            leadId = current?.id ?? null;
        }
        const dialer = this.dialers.get();
        const placed = await dialer.placeCall({ phoneE164: e164 });
        const call = await this.prisma.$transaction(async (tx) => {
            const row = await tx.call.create({
                data: {
                    customerId,
                    leadId,
                    agentId: actor.id,
                    phoneNumber: e164,
                    direction: shared_1.CallDirection.OUTBOUND,
                    status: placed.status,
                    provider: dialer.id,
                    providerCallId: placed.providerCallId,
                    startedAt: new Date(),
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CALL',
                entityId: row.id,
                entityLabel: e164,
                action: 'call.placed',
                after: { phoneNumber: e164, customerId, leadId, status: placed.status, provider: dialer.id },
            });
            return row;
        });
        return this.serialize({ ...call, notes: [] });
    }
    async detailOrThrow(id, actor) {
        const call = await this.requireCall(id, actor);
        await this.syncFromProvider(call);
        const fresh = await this.requireCall(id, actor);
        return this.serialize(fresh);
    }
    async endCall(id, actor) {
        const call = await this.prisma.call.findUnique({ where: { id } });
        if (!call || call.agentId !== actor.id)
            throw api_error_1.ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
        if (!shared_1.ACTIVE_CALL_STATUSES.includes(call.status)) {
            throw api_error_1.ApiError.conflict('CALL_NOT_ACTIVE', 'This call is already finished');
        }
        const snapshot = await this.dialers.get(call.provider).endCall(call.providerCallId);
        if (snapshot)
            await this.applySnapshot(call, snapshot);
        const [updated] = await Promise.all([
            this.requireCall(id, actor),
            this.audit.record(this.prisma, {
                actorId: actor.id,
                entityType: 'CALL',
                entityId: call.id,
                entityLabel: call.phoneNumber,
                action: 'call.ended',
                after: { status: shared_1.CallStatus.ENDED, endedAt: new Date().toISOString(), disconnectReason: shared_1.CallDisconnectReason.AGENT_ENDED },
            }),
        ]);
        return this.serialize(updated);
    }
    async addNote(id, actor, dto) {
        const call = await this.requireCall(id, actor);
        const note = await this.prisma.$transaction(async (tx) => {
            const row = await tx.callNote.create({
                data: { callId: call.id, authorId: actor.id, body: dto.body },
                include: { author: { select: { id: true, fullName: true } } },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CALL_NOTE',
                entityId: row.id,
                entityLabel: call.phoneNumber,
                action: 'call.note_added',
                after: { callId: call.id, body: dto.body },
            });
            return row;
        });
        return {
            id: note.id,
            callId: note.callId,
            author: note.author,
            body: note.body,
            createdAt: note.createdAt,
        };
    }
    async queue(actor, filters = {}) {
        const scopeOwner = actor.roleCode === 'AGENT' ? actor.id : (filters.ownerId ?? undefined);
        const leads = await this.prisma.lead.findMany({
            where: {
                deletedAt: null,
                status: 'OPEN',
                ...(scopeOwner
                    ? { ownerships: { some: { employeeId: scopeOwner, releasedAt: null } } }
                    : {}),
            },
            include: {
                customer: {
                    include: {
                        phones: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                        crops: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: 'asc' },
                            include: { crop: { select: { id: true, code: true, name: true, localName: true } } },
                        },
                    },
                },
                ownerships: {
                    where: { releasedAt: null },
                    include: { employee: { select: { id: true, fullName: true } } },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        const lastCalls = await this.prisma.call.findMany({
            where: { leadId: { in: leads.map((lead) => lead.id) } },
            orderBy: { startedAt: 'desc' },
        });
        const latestCallByLead = new Map();
        for (const call of lastCalls) {
            if (call.leadId && !latestCallByLead.has(call.leadId))
                latestCallByLead.set(call.leadId, call);
        }
        return leads.map((lead) => ({
            leadId: lead.id,
            source: lead.source,
            status: lead.status,
            notes: lead.notes,
            owner: lead.ownerships[0]?.employee ?? null,
            customer: {
                id: lead.customer.id,
                farmerCode: lead.customer.farmerCode,
                fullName: lead.customer.fullName,
                primaryPhone: lead.customer.phones[0]?.phoneE164 ?? null,
                crops: lead.customer.crops.map((c) => ({
                    crop: c.crop,
                    acreage: c.acreage.toNumber(),
                    unit: c.unit,
                })),
            },
            lastCall: latestCallByLead.get(lead.id) ? this.serializeCallBrief(latestCallByLead.get(lead.id)) : null,
        }));
    }
    async customerCalls(customerId, actor) {
        await this.customers.assertReadable(customerId, actor);
        const calls = await this.prisma.call.findMany({
            where: { customerId },
            include: {
                notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
            },
            orderBy: { startedAt: 'desc' },
            take: 50,
        });
        return calls.map((call) => this.serialize({ ...call, notes: call.notes }));
    }
    async callContext(id, actor) {
        const call = await this.requireCall(id, actor);
        const [customer, history, followUps, relationshipOwner] = await Promise.all([
            call.customerId ? this.customers.detailForCallContext(call.customerId) : null,
            call.customerId ? this.customerCallsForContext(call.customerId) : [],
            call.customerId
                ? this.prisma.followUp.findMany({
                    where: { customerId: call.customerId },
                    include: { agent: { select: { id: true, fullName: true } } },
                    orderBy: { dueAt: 'asc' },
                    take: 50,
                })
                : [],
            call.customerId
                ? this.prisma.relationshipOwnership.findFirst({
                    where: { customerId: call.customerId, releasedAt: null },
                    include: { employee: { select: { id: true, fullName: true } } },
                })
                : null,
        ]);
        return {
            call,
            customer,
            history,
            followUps: followUps.map((row) => this.serializeFollowUp(row)),
            relationshipOwner: relationshipOwner ? { id: relationshipOwner.employee.id, fullName: relationshipOwner.employee.fullName } : null,
        };
    }
    async customerCallsForContext(customerId) {
        const calls = await this.prisma.call.findMany({
            where: { customerId },
            include: {
                notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
            },
            orderBy: { startedAt: 'desc' },
            take: 50,
        });
        return calls.map((call) => this.serialize({ ...call, notes: call.notes }));
    }
    async recordOutcome(actor, id, dto) {
        const call = await this.requireCall(id, actor);
        if (shared_1.ACTIVE_CALL_STATUSES.includes(call.status)) {
            throw api_error_1.ApiError.conflict('CALL_NOT_FINISHED', 'Finish the call before recording an outcome');
        }
        if (call.status === shared_1.CallStatus.FAILED) {
            throw api_error_1.ApiError.conflict('OUTCOME_NOT_ALLOWED', 'An outcome cannot be recorded for a failed call');
        }
        if (call.status === shared_1.CallStatus.NOT_ANSWERED && dto.outcome !== shared_1.CallOutcome.NOT_ANSWERED) {
            throw api_error_1.ApiError.conflict('OUTCOME_MISMATCH', 'Only “Not Answered” can be recorded when the call was not answered');
        }
        if (call.outcome) {
            throw api_error_1.ApiError.conflict('CALL_OUTCOME_EXISTS', 'This call already has an outcome recorded');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const update = await tx.call.update({
                where: { id: call.id },
                data: { outcome: dto.outcome, nextAction: dto.nextAction ?? null },
                select: { id: true, outcome: true, nextAction: true },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CALL',
                entityId: call.id,
                entityLabel: call.phoneNumber,
                action: 'call.outcome_recorded',
                after: { outcome: update.outcome, nextAction: update.nextAction },
            });
            if (dto.outcome === shared_1.CallOutcome.INTERESTED) {
                if (!dto.nextAction) {
                    throw api_error_1.ApiError.badRequest('NEXT_ACTION_REQUIRED', 'Interested requires exactly one next action: Callback or Sales');
                }
                if (!call.customerId) {
                    throw api_error_1.ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
                }
                if (dto.nextAction === 'CALLBACK') {
                    const followUp = await this.createCallbackFollowUp(tx, actor, call, dto);
                    return { followUpId: followUp.id, followUp: this.serializeFollowUp(followUp), messageId: null };
                }
                const leadId = await this.closeOpenLead(tx, call);
                const rm = await this.assignRelationshipOwner(tx, actor, call, leadId);
                const message = await this.queueProductMessage(tx, actor, call);
                return { followUpId: null, followUp: null, messageId: message.id, rmId: rm.id };
            }
            if (dto.nextAction) {
                throw api_error_1.ApiError.badRequest('NEXT_ACTION_NOT_ALLOWED', 'Next action is only valid for an Interested outcome');
            }
            if (dto.outcome === shared_1.CallOutcome.NOT_INTERESTED && call.leadId) {
                await tx.lead.update({ where: { id: call.leadId }, data: { status: 'CLOSED' } });
            }
            return { followUpId: null, followUp: null, messageId: null, rmId: null };
        });
        if (result.messageId) {
            await this.messaging.deliver(result.messageId);
        }
        const fresh = await this.prisma.call.findUnique({
            where: { id },
            include: { notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } } },
        });
        if (!fresh)
            throw api_error_1.ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
        let relationshipOwner = null;
        if (result.rmId) {
            const row = await this.prisma.relationshipOwnership.findUnique({
                where: { id: result.rmId },
                include: { employee: { select: { id: true, fullName: true } } },
            });
            if (row)
                relationshipOwner = { id: row.employee.id, fullName: row.employee.fullName };
        }
        const messageStatus = result.messageId
            ? ((await this.prisma.outboundMessage.findUnique({ where: { id: result.messageId } }))?.status ?? null)
            : null;
        return {
            call: this.serialize(fresh),
            followUp: result.followUp ?? null,
            relationshipOwner,
            messageStatus,
        };
    }
    async createCallbackFollowUp(tx, actor, call, dto) {
        const missing = [];
        if (!dto.followUpDate)
            missing.push('followUpDate');
        if (!dto.followUpTime)
            missing.push('followUpTime');
        if (!dto.followUpNote?.trim())
            missing.push('followUpNote');
        if (missing.length > 0 || !call.customerId) {
            throw api_error_1.ApiError.badRequest('FOLLOW_UP_DETAILS_REQUIRED', 'Callback requires a follow-up date, time and reason/note', { missing });
        }
        const note = dto.followUpNote.trim();
        const dueAt = new Date(`${dto.followUpDate}T${dto.followUpTime}:00`);
        if (Number.isNaN(dueAt.getTime())) {
            throw api_error_1.ApiError.badRequest('INVALID_FOLLOW_UP_TIME', 'Follow-up date/time could not be parsed');
        }
        const row = await tx.followUp.create({
            data: {
                customerId: call.customerId,
                callId: call.id,
                leadId: call.leadId,
                agentId: actor.id,
                dueAt,
                note,
                status: shared_1.FollowUpStatus.PENDING,
            },
            include: { agent: { select: { id: true, fullName: true } } },
        });
        await this.audit.record(tx, {
            actorId: actor.id,
            entityType: 'FOLLOW_UP',
            entityId: row.id,
            entityLabel: `callback ${dueAt.toISOString()}`,
            action: 'followup.created',
            after: { customerId: call.customerId, callId: call.id, dueAt: dueAt.toISOString(), note: row.note },
        });
        return row;
    }
    async closeOpenLead(tx, call) {
        let leadId = call.leadId;
        if (!leadId && call.customerId) {
            const open = await tx.lead.findFirst({ where: { customerId: call.customerId, deletedAt: null, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
            leadId = open?.id ?? null;
        }
        if (leadId) {
            await tx.lead.update({ where: { id: leadId }, data: { status: 'CLOSED' } });
            await tx.leadOwnership.updateMany({ where: { leadId, releasedAt: null }, data: { releasedAt: new Date() } });
        }
        return leadId;
    }
    async assignRelationshipOwner(tx, actor, call, leadId) {
        if (!call.customerId) {
            throw api_error_1.ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
        }
        const rmEmail = (this.config.get('RELATIONSHIP_MANAGER_EMAIL') ?? 'manager@grotec.local').toLowerCase();
        const rm = await tx.employee.findUnique({ where: { email: rmEmail } });
        if (!rm) {
            this.logger.error(`default RM not found for email ${rmEmail} — set RELATIONSHIP_MANAGER_EMAIL`);
            throw api_error_1.ApiError.conflict('RM_NOT_CONFIGURED', 'No relationship manager is configured for conversion (RELATIONSHIP_MANAGER_EMAIL)');
        }
        await tx.relationshipOwnership.updateMany({ where: { customerId: call.customerId, releasedAt: null }, data: { releasedAt: new Date() } });
        const row = await tx.relationshipOwnership.create({
            data: {
                customerId: call.customerId,
                employeeId: rm.id,
                assignedById: actor.id,
                reason: 'conversion_sales',
            },
        });
        await this.audit.record(tx, {
            actorId: actor.id,
            entityType: 'RELATIONSHIP_OWNERSHIP',
            entityId: row.id,
            entityLabel: call.customerId,
            action: 'relationship.assigned',
            after: { customerId: call.customerId, rmEmployeeId: rm.id, sourceCallId: call.id, leadId },
        });
        return row;
    }
    async queueProductMessage(tx, actor, call) {
        if (!call.customerId)
            throw api_error_1.ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
        const customer = await tx.customer.findUnique({
            where: { id: call.customerId },
            select: { crops: { where: { deletedAt: null }, include: { crop: { select: { id: true, name: true } } } } },
        });
        const cropIds = customer?.crops.map((c) => c.crop.id) ?? [];
        const guidance = cropIds.length
            ? await tx.cropProductGuidance.findMany({
                where: { isActive: true, cropId: { in: cropIds } },
                select: { crop: { select: { name: true } }, recommendedProducts: true, usageGuidance: true },
                take: 2,
            })
            : [];
        const phone = await tx.customerPhone.findFirst({
            where: { customerId: call.customerId, deletedAt: null, isPrimary: true },
        });
        if (!phone)
            throw api_error_1.ApiError.conflict('CUSTOMER_PHONE_REQUIRED', 'Customer has no primary phone for the product message');
        const body = this.composeProductMessage(guidance);
        return this.messaging.queue(tx, {
            customerId: call.customerId,
            callId: call.id,
            recipientPhone: phone.phoneE164,
            body,
        });
    }
    composeProductMessage(guidance) {
        const intro = 'Thank you for your interest in GROTEC organic agri-inputs. ';
        if (guidance.length === 0) {
            return `${intro}Our relationship manager will contact you shortly with product details suited to your crops. — Grotec Agro Products`;
        }
        const lines = guidance.map((row) => `For ${row.crop.name}: ${row.recommendedProducts.join(', ')}${row.usageGuidance ? `. ${row.usageGuidance}` : ''}`);
        return `${intro}Recommended for your crops — ${lines.join(' ')} (follow the product label). — Grotec Agro Products`;
    }
    serializeFollowUp(row) {
        return {
            id: row.id,
            dueAt: row.dueAt,
            note: row.note,
            status: row.status,
            completedAt: row.completedAt,
            agent: row.agent ?? null,
        };
    }
    async syncFromProvider(call) {
        if (this.isTerminal(call.status))
            return;
        const snapshot = await this.dialers.get(call.provider).getStatus(call.providerCallId);
        if (!snapshot) {
            await this.markFailed(call);
            return;
        }
        const full = await this.prisma.call.findUnique({
            where: { id: call.id },
            select: { id: true, status: true, customerId: true, phoneNumber: true },
        });
        if (!full)
            return;
        await this.applySnapshot(full, snapshot);
    }
    async syncSnapshotFromWebhook(providerId, snapshot) {
        const call = await this.prisma.call.findUnique({ where: { providerCallId: snapshot.providerCallId, provider: providerId } });
        if (!call)
            return;
        await this.applySnapshot(call, snapshot);
    }
    async applySnapshot(call, snapshot) {
        const data = {
            status: snapshot.status,
            connectedAt: snapshot.connectedAt ?? undefined,
            endedAt: snapshot.endedAt ?? undefined,
            disconnectReason: snapshot.disconnectReason ?? undefined,
        };
        if (this.isTerminal(snapshot.status) && !call.customerId) {
            const match = await this.prisma.customerPhone.findFirst({
                where: { phoneE164: call.phoneNumber, deletedAt: null, customer: { deletedAt: null } },
            });
            if (match) {
                data.customer = { connect: { id: match.customerId } };
                const current = await this.prisma.lead.findFirst({
                    where: { customerId: match.customerId, deletedAt: null, status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                });
                if (current)
                    data.lead = { connect: { id: current.id } };
                await this.audit.record(this.prisma, {
                    actorId: null,
                    entityType: 'CALL',
                    entityId: call.id,
                    entityLabel: call.phoneNumber,
                    action: 'call.linked',
                    after: { customerId: match.customerId },
                });
            }
        }
        await this.prisma.call.update({ where: { id: call.id }, data });
    }
    async markFailed(call) {
        await this.prisma.call.update({
            where: { id: call.id },
            data: { status: shared_1.CallStatus.FAILED, endedAt: new Date(), disconnectReason: shared_1.CallDisconnectReason.UNKNOWN },
        });
    }
    isTerminal(status) {
        return !shared_1.ACTIVE_CALL_STATUSES.includes(status);
    }
    async requireCall(id, actor) {
        const call = await this.prisma.call.findUnique({
            where: { id },
            include: {
                notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
            },
        });
        if (!call)
            throw api_error_1.ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
        if (actor.roleCode === 'AGENT' && call.agentId !== actor.id) {
            throw api_error_1.ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
        }
        return call;
    }
    serialize(call) {
        return {
            id: call.id,
            customerId: call.customerId,
            leadId: call.leadId,
            agentId: call.agentId,
            phoneNumber: call.phoneNumber,
            direction: call.direction,
            status: call.status,
            outcome: call.outcome,
            nextAction: call.nextAction,
            provider: call.provider,
            providerCallId: call.providerCallId,
            connectedAt: call.connectedAt,
            startedAt: call.startedAt,
            endedAt: call.endedAt,
            disconnectReason: call.disconnectReason,
            createdAt: call.createdAt,
            updatedAt: call.updatedAt,
            notes: call.notes ?? [],
        };
    }
    serializeCallBrief(call) {
        return {
            id: call.id,
            phoneNumber: call.phoneNumber,
            status: call.status,
            disconnectReason: call.disconnectReason,
            startedAt: call.startedAt,
            endedAt: call.endedAt,
        };
    }
};
exports.CallsService = CallsService;
exports.CallsService = CallsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        dialer_registry_1.DialerRegistry,
        customers_service_1.CustomersService,
        messaging_service_1.MessagingService,
        config_1.ConfigService])
], CallsService);
//# sourceMappingURL=calls.service.js.map