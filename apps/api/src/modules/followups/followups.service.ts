import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, FollowUpStatus } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FollowUpFilters {
  customerId?: string;
  status?: FollowUpStatus;
  ownerId?: string;
}

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthEmployee, filters: FollowUpFilters = {}) {
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

  async complete(actor: AuthEmployee, id: string) {
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

  private serialize(row: {
    id: string;
    dueAt: Date;
    note: string;
    status: FollowUpStatus;
    completedAt: Date | null;
    agent: { id: string; fullName: string };
    customer: { id: string; fullName: string; farmerCode: string | null };
  }) {
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
}
