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
import { MessageType } from '@prisma/client';
import { AuditAction, AuditEntityType, MessageStatus } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagingRegistry } from './messaging.registry';
/**
 * Owns the outbound_messages log (PRD §6.3.10). A message row is queued inside
 * the outcome transaction that triggers it; delivery happens after commit so a
 * provider failure can never roll back the outcome. Failures are stored with
 * the provider error and attempts count — surfaced, never silent (§12).
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
        if (!message)
            return;
        const provider = this.registry.get(message.provider);
        let status = MessageStatus.SENT;
        let providerMessageId = null;
        let error = null;
        try {
            const result = await provider.send({ to: message.recipientPhone, body: message.body });
            status = result.status;
            providerMessageId = result.providerMessageId;
            error = result.error ?? null;
        }
        catch (err) {
            status = MessageStatus.FAILED;
            error = err instanceof Error ? err.message.slice(0, 500) : 'delivery failed';
            this.logger.warn(`message ${message.id} delivery failed: ${error}`);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.outboundMessage.update({
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
        });
    }
};
MessagingService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof MessagingRegistry !== "undefined" && MessagingRegistry) === "function" ? _c : Object])
], MessagingService);
export { MessagingService };
