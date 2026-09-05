import { Injectable, Logger } from '@nestjs/common';
import { MessageType, Prisma } from '@prisma/client';
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
@Injectable()
export class MessagingService {
  private readonly logger = new Logger('MessagingService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registry: MessagingRegistry,
  ) {}

  queue(tx: Prisma.TransactionClient, input: { customerId: string; callId?: string | null; recipientPhone: string; body: string; type?: MessageType }) {
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
  async deliver(messageId: string): Promise<void> {
    const message = await this.prisma.outboundMessage.findUnique({ where: { id: messageId } });
    if (!message) return;

    const provider = this.registry.get(message.provider);
    let status: MessageStatus = MessageStatus.SENT;
    let providerMessageId: string | null = null;
    let error: string | null = null;
    try {
      const result = await provider.send({ to: message.recipientPhone, body: message.body });
      status = result.status;
      providerMessageId = result.providerMessageId;
      error = result.error ?? null;
    } catch (err) {
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
}
