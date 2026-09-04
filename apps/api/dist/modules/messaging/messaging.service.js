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
exports.MessagingService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const messaging_registry_1 = require("./messaging.registry");
let MessagingService = class MessagingService {
    prisma;
    audit;
    registry;
    logger = new common_1.Logger('MessagingService');
    constructor(prisma, audit, registry) {
        this.prisma = prisma;
        this.audit = audit;
        this.registry = registry;
    }
    queue(tx, input) {
        const provider = this.registry.get();
        return tx.outboundMessage.create({
            data: {
                customerId: input.customerId,
                callId: input.callId ?? null,
                type: input.type ?? shared_1.MessageType.PRODUCT_DETAILS,
                provider: provider.id,
                recipientPhone: input.recipientPhone,
                body: input.body,
                status: shared_1.MessageStatus.PENDING,
            },
        });
    }
    async deliver(messageId) {
        const message = await this.prisma.outboundMessage.findUnique({ where: { id: messageId } });
        if (!message)
            return;
        const provider = this.registry.get(message.provider);
        let status = shared_1.MessageStatus.SENT;
        let providerMessageId = null;
        let error = null;
        try {
            const result = await provider.send({ to: message.recipientPhone, body: message.body });
            status = result.status;
            providerMessageId = result.providerMessageId;
            error = result.error ?? null;
        }
        catch (err) {
            status = shared_1.MessageStatus.FAILED;
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
                    sentAt: status === shared_1.MessageStatus.SENT ? new Date() : null,
                    attempts: { increment: 1 },
                },
            });
            await this.audit.record(tx, {
                actorId: null,
                entityType: shared_1.AuditEntityType.OUTBOUND_MESSAGE,
                entityId: message.id,
                entityLabel: message.recipientPhone,
                action: status === shared_1.MessageStatus.SENT ? shared_1.AuditAction.MESSAGE_SENT : shared_1.AuditAction.MESSAGE_FAILED,
                after: { status, providerMessageId, error, body: message.body },
            });
        });
    }
};
exports.MessagingService = MessagingService;
exports.MessagingService = MessagingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        messaging_registry_1.MessagingRegistry])
], MessagingService);
//# sourceMappingURL=messaging.service.js.map