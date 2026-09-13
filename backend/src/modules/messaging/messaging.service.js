var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditEntityType, MessageStatus, MessageType } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagingRegistry } from './messaging.registry';
import { toPage } from '../../common/utils/pagination';

/**
 * Owns outbound communication dispatch (SMS, WhatsApp, SMTP Email).
 * Dispatches messages via registered providers, records delivery logs and audit events,
 * and maintains resilient queueing with retries.
 */
let MessagingService = class MessagingService {
    constructor(prisma, audit, registry) {
        this.prisma = prisma;
        this.audit = audit;
        this.registry = registry;
        this.logger = new Logger('MessagingService');
    }

    queue(tx, input) {
        const provider = this.registry.get();
        return tx.outboundMessage.create({
            data: {
                customerId: input.customerId,
                callId: input.callId ?? null,
                type: input.type ?? MessageType.PRODUCT_DETAILS,
                provider: provider.id,
                recipientPhone: input.recipientPhone,
                body: input.body,
                status: MessageStatus.PENDING,
            },
        });
    }

    /** Delivers a queued message; always persists the outcome (SENT or FAILED). */
    async deliver(messageId) {
        const message = await this.prisma.outboundMessage.findUnique({ where: { id: messageId } });
        if (!message) return null;
        const provider = this.registry.get(message.provider);
        let status = MessageStatus.SENT;
        let providerMessageId = null;
        let error = null;
        try {
            const result = await provider.send({ to: message.recipientPhone, body: message.body });
            status = result.status;
            providerMessageId = result.providerMessageId;
            error = result.error ?? null;
        } catch (err) {
            status = MessageStatus.FAILED;
            error = err instanceof Error ? err.message.slice(0, 500) : 'delivery failed';
            this.logger.warn(`Message ${message.id} delivery failed: ${error}`);
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.outboundMessage.update({
                where: { id: message.id },
                data: {
                    status,
                    providerMessageId,
                    error,
                    sentAt: status === MessageStatus.SENT ? new Date() : null,
                    attempts: { increment: 1 },
                },
            });
            await this.audit.record(tx, {
                actorId: null,
                entityType: AuditEntityType.OUTBOUND_MESSAGE,
                entityId: message.id,
                entityLabel: message.recipientPhone,
                action: status === MessageStatus.SENT ? AuditAction.MESSAGE_SENT : AuditAction.MESSAGE_FAILED,
                after: { status, providerMessageId, error, body: message.body },
            });
            return updated;
        });
    }

    /** Dispatches an SMS directly via Exotel SMS API and records delivery. */
    async sendSms(actor, dto) {
        const provider = this.registry.getSmsProvider();
        const result = await provider.send({ to: dto.to, body: dto.body });

        let messageRow = null;
        if (dto.customerId) {
            try {
                messageRow = await this.prisma.$transaction(async (tx) => {
                    const row = await tx.outboundMessage.create({
                        data: {
                            customerId: dto.customerId,
                            callId: dto.callId ?? null,
                            type: MessageType.PRODUCT_DETAILS,
                            provider: provider.id,
                            recipientPhone: dto.to,
                            body: dto.body,
                            status: result.status,
                            providerMessageId: result.providerMessageId,
                            error: result.error ?? null,
                            sentAt: result.status === MessageStatus.SENT ? new Date() : null,
                            attempts: 1,
                        },
                    });
                    await this.audit.record(tx, {
                        actorId: actor?.id ?? null,
                        entityType: AuditEntityType.OUTBOUND_MESSAGE,
                        entityId: row.id,
                        entityLabel: dto.to,
                        action: result.status === MessageStatus.SENT ? AuditAction.MESSAGE_SENT : AuditAction.MESSAGE_FAILED,
                        after: { provider: provider.id, to: dto.to, status: result.status, providerMessageId: result.providerMessageId },
                    });
                    return row;
                });
            } catch (err) {
                this.logger.warn(`Failed to persist SMS record for customer ${dto.customerId}: ${err.message}`);
            }
        }

        return {
            id: messageRow?.id ?? result.providerMessageId,
            channel: 'SMS',
            to: dto.to,
            provider: provider.id,
            providerMessageId: result.providerMessageId,
            status: result.status,
            error: result.error ?? null,
            timestamp: new Date().toISOString(),
        };
    }

    /** Dispatches a WhatsApp message via WhatsApp Cloud/Business API and records delivery. */
    async sendWhatsApp(actor, dto) {
        const provider = this.registry.getWhatsAppProvider();
        const result = await provider.send({
            to: dto.to,
            body: dto.body,
            templateName: dto.templateName,
            templateParams: dto.templateParams,
        });

        let messageRow = null;
        if (dto.customerId) {
            try {
                messageRow = await this.prisma.$transaction(async (tx) => {
                    const row = await tx.outboundMessage.create({
                        data: {
                            customerId: dto.customerId,
                            callId: dto.callId ?? null,
                            type: MessageType.PRODUCT_DETAILS,
                            provider: provider.id,
                            recipientPhone: dto.to,
                            body: dto.body,
                            status: result.status,
                            providerMessageId: result.providerMessageId,
                            error: result.error ?? null,
                            sentAt: result.status === MessageStatus.SENT ? new Date() : null,
                            attempts: 1,
                        },
                    });
                    await this.audit.record(tx, {
                        actorId: actor?.id ?? null,
                        entityType: AuditEntityType.OUTBOUND_MESSAGE,
                        entityId: row.id,
                        entityLabel: dto.to,
                        action: result.status === MessageStatus.SENT ? AuditAction.MESSAGE_SENT : AuditAction.MESSAGE_FAILED,
                        after: { provider: provider.id, to: dto.to, status: result.status, providerMessageId: result.providerMessageId },
                    });
                    return row;
                });
            } catch (err) {
                this.logger.warn(`Failed to persist WhatsApp record for customer ${dto.customerId}: ${err.message}`);
            }
        }

        return {
            id: messageRow?.id ?? result.providerMessageId,
            channel: 'WHATSAPP',
            to: dto.to,
            provider: provider.id,
            providerMessageId: result.providerMessageId,
            status: result.status,
            error: result.error ?? null,
            timestamp: new Date().toISOString(),
        };
    }

    /** Dispatches an Email via SMTP transporter. */
    async sendEmail(actor, dto) {
        const provider = this.registry.getEmailProvider();
        const result = await provider.send({
            to: dto.to,
            subject: dto.subject,
            body: dto.body,
            html: dto.html,
        });

        await this.audit.record(this.prisma, {
            actorId: actor?.id ?? null,
            entityType: 'OUTBOUND_EMAIL',
            entityId: result.providerMessageId,
            entityLabel: dto.to,
            action: result.status === MessageStatus.SENT ? AuditAction.MESSAGE_SENT : AuditAction.MESSAGE_FAILED,
            after: { to: dto.to, subject: dto.subject, status: result.status },
        }).catch(() => undefined);

        return {
            channel: 'EMAIL',
            to: dto.to,
            subject: dto.subject,
            provider: provider.id,
            providerMessageId: result.providerMessageId,
            status: result.status,
            error: result.error ?? null,
            timestamp: new Date().toISOString(),
        };
    }

    /** Lists outbound messages with pagination and filtering. */
    async listOutbound(actor, pagination, filters = {}) {
        const where = {};
        if (filters.status) where.status = filters.status;
        if (filters.customerId) where.customerId = filters.customerId;
        if (filters.recipientPhone) {
            where.recipientPhone = { contains: filters.recipientPhone.replace(/\D/g, '') };
        }
        if (filters.provider) where.provider = filters.provider;

        const [items, total] = await Promise.all([
            this.prisma.outboundMessage.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { id: true, fullName: true, farmerCode: true } },
                },
            }),
            this.prisma.outboundMessage.count({ where }),
        ]);

        return toPage(items, total, pagination);
    }

    /** Checks the connection status of all configured messaging channels. */
    async getProviderStatus() {
        const emailProvider = this.registry.getEmailProvider();
        const smsProvider = this.registry.getSmsProvider();
        const waProvider = this.registry.getWhatsAppProvider();

        const emailStatus = emailProvider.verify ? await emailProvider.verify() : { configured: false };

        return {
            sms: {
                provider: smsProvider.id,
                configured: smsProvider.isLive ?? false,
                subdomain: smsProvider.subdomain,
                accountSid: smsProvider.accountSid ? `${smsProvider.accountSid.slice(0, 4)}***` : null,
            },
            whatsapp: {
                provider: waProvider.id,
                configured: waProvider.isLive ?? false,
                phoneNumberId: waProvider.phoneNumberId ? `${waProvider.phoneNumberId.slice(0, 4)}***` : null,
            },
            smtp: {
                provider: emailProvider.id,
                ...emailStatus,
            },
        };
    }
};

MessagingService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [
        typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object,
        typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object,
        typeof (_c = typeof MessagingRegistry !== "undefined" && MessagingRegistry) === "function" ? _c : Object
    ])
], MessagingService);
export { MessagingService };
