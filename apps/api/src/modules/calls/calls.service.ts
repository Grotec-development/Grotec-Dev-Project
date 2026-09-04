import { Injectable } from '@nestjs/common';
import {
  ACTIVE_CALL_STATUSES,
  CallDirection,
  CallDisconnectReason,
  CallStatus,
  type CallStatus as CallStatusEnum,
} from '@grotec/shared';
import { normalizePhoneToE164 } from '@grotec/shared';
import type { Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { DialerRegistry } from './dialer/dialer.registry';
import type { CallStatusSnapshot } from './dialer/auto-dialer.types';
import type { AddNoteDto } from './dto/add-note.dto';
import type { PlaceCallDto } from './dto/place-call.dto';

export interface CallFilters {
  ownerId?: string;
}

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dialers: DialerRegistry,
    private readonly customers: CustomersService,
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

  /** Full calling-workspace context for one call: call + customer + history + notes. */
  async callContext(id: string, actor: AuthEmployee) {
    const call = await this.requireCall(id, actor);
    const [customer, history] = await Promise.all([
      call.customerId ? this.customers.detailForCallContext(call.customerId) : null,
      call.customerId ? this.customerCallsForContext(call.customerId) : [],
    ]);
    return { call, customer, history };
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

  private serialize(call: { id: string; customerId: string | null; leadId: string | null; agentId: string; phoneNumber: string; direction: CallDirection; status: CallStatusEnum; provider: string; providerCallId: string; connectedAt: Date | null; startedAt: Date; endedAt: Date | null; disconnectReason: string | null; createdAt: Date; updatedAt: Date; notes?: Array<{ id: string; body: string; createdAt: Date; author: { id: string; fullName: string } }> }) {
    return {
      id: call.id,
      customerId: call.customerId,
      leadId: call.leadId,
      agentId: call.agentId,
      phoneNumber: call.phoneNumber,
      direction: call.direction,
      status: call.status,
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