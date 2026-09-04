import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACTIVE_CALL_STATUSES,
  CallDirection,
  CallDisconnectReason,
  CallOutcome,
  CallStatus,
  FollowUpStatus,
  type CallStatus as CallStatusEnum,
  type NextAction,
} from '@grotec/shared';
import { normalizePhoneToE164 } from '@grotec/shared';
import type { Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { MessagingService } from '../messaging/messaging.service';
import { DialerRegistry } from './dialer/dialer.registry';
import type { CallStatusSnapshot } from './dialer/auto-dialer.types';
import type { AddNoteDto } from './dto/add-note.dto';
import type { PlaceCallDto } from './dto/place-call.dto';
import type { RecordOutcomeDto } from './dto/record-outcome.dto';

export interface CallFilters {
  ownerId?: string;
}

@Injectable()
export class CallsService {
  private readonly logger = new Logger('CallsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dialers: DialerRegistry,
    private readonly customers: CustomersService,
    private readonly messaging: MessagingService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------- dialing

  async placeCall(actor: AuthEmployee, dto: PlaceCallDto) {
    const e164 = normalizePhoneToE164(dto.phoneNumber);
    if (!e164) {
      throw ApiError.badRequest('INVALID_PHONE', `Phone number could not be normalized: "${dto.phoneNumber}"`);
    }

    const active = await this.prisma.call.findFirst({
      where: { agentId: actor.id, status: { in: [...ACTIVE_CALL_STATUSES] } },
    });
    if (active) {
      throw ApiError.conflict('ACTIVE_CALL_EXISTS', 'You already have an active call on this workspace', { callId: active.id });
    }

    // Phone resolution first (PRD §6.3.5): prefer an explicit customerId, else
    // resolve the number to the existing customer master.
    let customerId: string | null = null;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
      if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
      customerId = dto.customerId;
    } else {
      const match = await this.prisma.customerPhone.findFirst({
        where: { phoneE164: e164, deletedAt: null, customer: { deletedAt: null } },
      });
      customerId = match?.customerId ?? null;
    }

    let leadId = dto.leadId ?? null;
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, deletedAt: null } });
      if (!lead) throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
    } else if (customerId) {
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
          direction: CallDirection.OUTBOUND,
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

  async detailOrThrow(id: string, actor: AuthEmployee) {
    const call = await this.requireCall(id, actor);
    await this.syncFromProvider(call);
    const fresh = await this.requireCall(id, actor);
    return this.serialize(fresh);
  }

  async endCall(id: string, actor: AuthEmployee) {
    const call = await this.prisma.call.findUnique({ where: { id } });
    if (!call || call.agentId !== actor.id) throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
    if (!ACTIVE_CALL_STATUSES.includes(call.status)) {
      throw ApiError.conflict('CALL_NOT_ACTIVE', 'This call is already finished');
    }
    const snapshot = await this.dialers.get(call.provider).endCall(call.providerCallId);
    if (snapshot) await this.applySnapshot(call, snapshot);

    const [updated] = await Promise.all([
      this.requireCall(id, actor),
      this.audit.record(this.prisma, {
        actorId: actor.id,
        entityType: 'CALL',
        entityId: call.id,
        entityLabel: call.phoneNumber,
        action: 'call.ended',
        after: { status: CallStatus.ENDED, endedAt: new Date().toISOString(), disconnectReason: CallDisconnectReason.AGENT_ENDED },
      }),
    ]);
    return this.serialize(updated);
  }

  // -------------------------------------------------------------------- notes

  async addNote(id: string, actor: AuthEmployee, dto: AddNoteDto) {
    const call = await this.requireCall(id, actor); // agent-ownership + permission gate
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

  // -------------------------------------------------------------- workspace

  async queue(actor: AuthEmployee, filters: CallFilters = {}) {
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
    const latestCallByLead = new Map<string, (typeof lastCalls)[number]>();
    for (const call of lastCalls) {
      if (call.leadId && !latestCallByLead.has(call.leadId)) latestCallByLead.set(call.leadId, call);
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
      lastCall: latestCallByLead.get(lead.id) ? this.serializeCallBrief(latestCallByLead.get(lead.id) as never) : null,
    }));
  }

  async customerCalls(customerId: string, actor: AuthEmployee) {
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

  /** Full calling-workspace context for one call: call + customer + history + follow-ups. */
  async callContext(id: string, actor: AuthEmployee) {
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

  async customerCallsForContext(customerId: string) {
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

  // ------------------------------------------------------- call outcomes

  /**
   * Records one of exactly three call outcomes (PRD §6.3.6–6.3.9) and applies
   * the consequences:
   * - INTERESTED → requires exactly one next action. CALLBACK creates a
   *   follow-up (date + time + reason). SALES closes the lead, releases agent
   *   ownership, creates relationship (RM) ownership and queues the automatic
   *   product-detail message (§6.3.10).
   * - NOT_INTERESTED → closes the lead; history only.
   * - NOT_ANSWERED → history only; no retry / no automatic follow-up (open).
   */
  async recordOutcome(actor: AuthEmployee, id: string, dto: RecordOutcomeDto) {
    const call = await this.requireCall(id, actor);
    if (ACTIVE_CALL_STATUSES.includes(call.status)) {
      throw ApiError.conflict('CALL_NOT_FINISHED', 'Finish the call before recording an outcome');
    }
    if (call.status === CallStatus.FAILED) {
      throw ApiError.conflict('OUTCOME_NOT_ALLOWED', 'An outcome cannot be recorded for a failed call');
    }
    if (call.status === CallStatus.NOT_ANSWERED && dto.outcome !== CallOutcome.NOT_ANSWERED) {
      throw ApiError.conflict('OUTCOME_MISMATCH', 'Only “Not Answered” can be recorded when the call was not answered');
    }
    if (call.outcome) {
      throw ApiError.conflict('CALL_OUTCOME_EXISTS', 'This call already has an outcome recorded');
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

      if (dto.outcome === CallOutcome.INTERESTED) {
        if (!dto.nextAction) {
          throw ApiError.badRequest('NEXT_ACTION_REQUIRED', 'Interested requires exactly one next action: Callback or Sales');
        }
        if (!call.customerId) {
          throw ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
        }
        if (dto.nextAction === 'CALLBACK') {
          const followUp = await this.createCallbackFollowUp(tx, actor, call, dto);
          return { followUpId: followUp.id, followUp: this.serializeFollowUp(followUp), messageId: null };
        }
        // SALES — progression + RM handoff + automatic product communication.
        const leadId = await this.closeOpenLead(tx, call);
        const rm = await this.assignRelationshipOwner(tx, actor, call, leadId);
        const message = await this.queueProductMessage(tx, actor, call);
        return { followUpId: null, followUp: null, messageId: message.id, rmId: rm.id };
      }

      // NOT_INTERESTED / NOT_ANSWERED: nextAction is forbidden here.
      if (dto.nextAction) {
        throw ApiError.badRequest('NEXT_ACTION_NOT_ALLOWED', 'Next action is only valid for an Interested outcome');
      }
      if (dto.outcome === CallOutcome.NOT_INTERESTED && call.leadId) {
        await tx.lead.update({ where: { id: call.leadId }, data: { status: 'CLOSED' } });
      }
      return { followUpId: null, followUp: null, messageId: null, rmId: null };
    });

    // Deliver the queued product message after commit — a provider failure must
    // never roll back the outcome; it is recorded as FAILED instead (§12).
    if (result.messageId) {
      await this.messaging.deliver(result.messageId);
    }

    const fresh = await this.prisma.call.findUnique({
      where: { id },
      include: { notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!fresh) throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');

    let relationshipOwner: { id: string; fullName: string } | null = null;
    if (result.rmId) {
      const row = await this.prisma.relationshipOwnership.findUnique({
        where: { id: result.rmId },
        include: { employee: { select: { id: true, fullName: true } } },
      });
      if (row) relationshipOwner = { id: row.employee.id, fullName: row.employee.fullName };
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

  /** Callback follow-up creation: date + time + reason are mandatory (§6.3.7). */
  private async createCallbackFollowUp(
    tx: Prisma.TransactionClient,
    actor: AuthEmployee,
    call: { id: string; customerId: string | null; leadId: string | null },
    dto: RecordOutcomeDto,
  ) {
    const missing: string[] = [];
    if (!dto.followUpDate) missing.push('followUpDate');
    if (!dto.followUpTime) missing.push('followUpTime');
    if (!dto.followUpNote?.trim()) missing.push('followUpNote');
    if (missing.length > 0 || !call.customerId) {
      throw ApiError.badRequest('FOLLOW_UP_DETAILS_REQUIRED', 'Callback requires a follow-up date, time and reason/note', { missing });
    }
    const note = (dto.followUpNote as string).trim();
    // Date + time arrive in local business time; combined into one due_at.
    // (Scheduling timezone is a documented open item.)
    const dueAt = new Date(`${dto.followUpDate as string}T${dto.followUpTime as string}:00`);
    if (Number.isNaN(dueAt.getTime())) {
      throw ApiError.badRequest('INVALID_FOLLOW_UP_TIME', 'Follow-up date/time could not be parsed');
    }
    const row = await tx.followUp.create({
      data: {
        customerId: call.customerId,
        callId: call.id,
        leadId: call.leadId,
        agentId: actor.id,
        dueAt,
        note,
        status: FollowUpStatus.PENDING,
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

  /** Sales/declined progression: close the open lead (operational OPEN/CLOSED). */
  private async closeOpenLead(
    tx: Prisma.TransactionClient,
    call: { id: string; leadId: string | null; customerId: string | null },
  ): Promise<string | null> {
    let leadId = call.leadId;
    if (!leadId && call.customerId) {
      const open = await tx.lead.findFirst({ where: { customerId: call.customerId, deletedAt: null, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
      leadId = open?.id ?? null;
    }
    if (leadId) {
      await tx.lead.update({ where: { id: leadId }, data: { status: 'CLOSED' } });
      // Release the agent's lead ownership: the lead leaves the calling queue.
      await tx.leadOwnership.updateMany({ where: { leadId, releasedAt: null }, data: { releasedAt: new Date() } });
    }
    return leadId;
  }

  /** Creates relationship (RM) ownership for the converted customer (§6.4). */
  private async assignRelationshipOwner(
    tx: Prisma.TransactionClient,
    actor: AuthEmployee,
    call: { id: string; customerId: string | null },
    leadId: string | null,
  ) {
    if (!call.customerId) {
      throw ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
    }
    const rmEmail = (this.config.get<string>('RELATIONSHIP_MANAGER_EMAIL') ?? 'manager@grotec.local').toLowerCase();
    const rm = await tx.employee.findUnique({ where: { email: rmEmail } });
    if (!rm) {
      this.logger.error(`default RM not found for email ${rmEmail} — set RELATIONSHIP_MANAGER_EMAIL`);
      throw ApiError.conflict('RM_NOT_CONFIGURED', 'No relationship manager is configured for conversion (RELATIONSHIP_MANAGER_EMAIL)');
    }
    // Reassigning an existing active RM is an authorised Founder/Manager workflow (Month 4).
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

  /** Automatic product communication (§6.3.10): content from crop guidance. */
  private async queueProductMessage(
    tx: Prisma.TransactionClient,
    actor: AuthEmployee,
    call: { id: string; customerId: string | null },
  ) {
    if (!call.customerId) throw ApiError.conflict('CUSTOMER_REQUIRED', 'Create or link the customer before recording this outcome');
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
    if (!phone) throw ApiError.conflict('CUSTOMER_PHONE_REQUIRED', 'Customer has no primary phone for the product message');

    const body = this.composeProductMessage(guidance);
    return this.messaging.queue(tx, {
      customerId: call.customerId,
      callId: call.id,
      recipientPhone: phone.phoneE164,
      body,
    });
  }

  private composeProductMessage(
    guidance: Array<{ crop: { name: string }; recommendedProducts: string[]; usageGuidance: string | null }>,
  ): string {
    const intro = 'Thank you for your interest in GROTEC organic agri-inputs. ';
    if (guidance.length === 0) {
      return `${intro}Our relationship manager will contact you shortly with product details suited to your crops. — Grotec Agro Products`;
    }
    const lines = guidance.map(
      (row) => `For ${row.crop.name}: ${row.recommendedProducts.join(', ')}${row.usageGuidance ? `. ${row.usageGuidance}` : ''}`,
    );
    return `${intro}Recommended for your crops — ${lines.join(' ')} (follow the product label). — Grotec Agro Products`;
  }

  private serializeFollowUp(row: {
    id: string;
    dueAt: Date;
    note: string;
    status: FollowUpStatus;
    completedAt: Date | null;
    agent?: { id: string; fullName: string } | null;
  }) {
    return {
      id: row.id,
      dueAt: row.dueAt,
      note: row.note,
      status: row.status,
      completedAt: row.completedAt,
      agent: row.agent ?? null,
    };
  }

  // -------------------------------------------------------- provider sync

  /** Pulls current status from the provider and reconciles the call row. */
  async syncFromProvider(call: {
    id: string;
    provider: string;
    providerCallId: string;
    status: CallStatusEnum;
  }): Promise<void> {
    if (this.isTerminal(call.status)) return;
    const snapshot = await this.dialers.get(call.provider).getStatus(call.providerCallId);
    if (!snapshot) {
      await this.markFailed(call);
      return;
    }
    const full = await this.prisma.call.findUnique({
      where: { id: call.id },
      select: { id: true, status: true, customerId: true, phoneNumber: true },
    });
    if (!full) return;
    await this.applySnapshot(full, snapshot);
  }

  /** Syncs a provider-pushed status (webhook or poll). Called by the sync loop. */
  async syncSnapshotFromWebhook(providerId: string, snapshot: CallStatusSnapshot): Promise<void> {
    const call = await this.prisma.call.findUnique({ where: { providerCallId: snapshot.providerCallId, provider: providerId } });
    if (!call) return;
    await this.applySnapshot(call, snapshot);
  }

  /**
   * Applies a provider snapshot to the call row; when the call turns terminal
   * it links any newly-created customer whose phone matches the dialed number
   * (PRD §6.3.5 — creating a customer during the call must not end it).
   */
  private async applySnapshot(call: { id: string; status: CallStatusEnum; customerId: string | null; phoneNumber: string }, snapshot: CallStatusSnapshot): Promise<void> {
    const data: Prisma.CallUpdateInput = {
      status: snapshot.status,
      connectedAt: snapshot.connectedAt ?? undefined,
      endedAt: snapshot.endedAt ?? undefined,
      disconnectReason: snapshot.disconnectReason ?? undefined,
    };
    // A call may have been placed before the customer existed (PRD §6.3.5) —
    // once it finishes, link any customer whose phone matches the dialed number.
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
        if (current) data.lead = { connect: { id: current.id } };
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

  private async markFailed(call: { id: string }) {
    await this.prisma.call.update({
      where: { id: call.id },
      data: { status: CallStatus.FAILED, endedAt: new Date(), disconnectReason: CallDisconnectReason.UNKNOWN },
    });
  }

  // ------------------------------------------------------------------ helpers

  private isTerminal(status: CallStatusEnum): boolean {
    return !ACTIVE_CALL_STATUSES.includes(status);
  }

  private async requireCall(id: string, actor: AuthEmployee) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      include: {
        notes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!call) throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
    if (actor.roleCode === 'AGENT' && call.agentId !== actor.id) {
      throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');
    }
    return call;
  }

  private serialize(call: {
    id: string;
    customerId: string | null;
    leadId: string | null;
    agentId: string;
    phoneNumber: string;
    direction: CallDirection;
    status: CallStatusEnum;
    outcome: string | null;
    nextAction: string | null;
    provider: string;
    providerCallId: string;
    connectedAt: Date | null;
    startedAt: Date;
    endedAt: Date | null;
    disconnectReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    notes?: Array<{ id: string; body: string; createdAt: Date; author: { id: string; fullName: string } }>;
  }) {
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

  private serializeCallBrief(call: { id: string; status: CallStatusEnum; startedAt: Date; endedAt: Date | null; phoneNumber: string; disconnectReason: string | null }) {
    return {
      id: call.id,
      phoneNumber: call.phoneNumber,
      status: call.status,
      disconnectReason: call.disconnectReason,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
    };
  }
}