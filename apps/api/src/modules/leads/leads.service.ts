import { Injectable } from '@nestjs/common';
import { EmployeeStatus, LeadStatus, Prisma } from '@prisma/client';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage, type PageParams } from '../../common/utils/pagination';

const LEAD_DETAIL_INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      status: true,
      phones: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        select: { phoneE164: true },
      },
    },
  },
  ownerships: {
    orderBy: { assignedAt: 'desc' },
    include: {
      employee: { select: { id: true, fullName: true } },
      assignedBy: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.LeadInclude;

export interface LeadFilters {
  status?: LeadStatus;
  ownerId?: string;
  q?: string;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthEmployee, pagination: PageParams, filters: LeadFilters) {
    const conditions: Prisma.LeadWhereInput[] = [{ deletedAt: null }, this.scopeWhere(actor)];
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.ownerId) {
      conditions.push({ ownerships: { some: { employeeId: filters.ownerId, releasedAt: null } } });
    }
    if (filters.q) {
      conditions.push({ customer: { fullName: { contains: filters.q, mode: 'insensitive' } } });
    }
    const where: Prisma.LeadWhereInput = { AND: conditions };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, status: true } },
          ownerships: {
            where: { releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return toPage(
      items.map((lead) => ({
        id: lead.id,
        customer: lead.customer,
        status: lead.status,
        source: lead.source,
        notes: lead.notes,
        createdAt: lead.createdAt,
        owner: lead.ownerships[0]?.employee ?? null,
      })),
      total,
      pagination,
    );
  }

  async detailOrThrow(id: string, actor: AuthEmployee) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, AND: [this.scopeWhere(actor)] },
      include: LEAD_DETAIL_INCLUDE,
    });
    if (!lead) throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');
    return serializeLead(lead);
  }

  async create(actor: AuthEmployee, input: { customerId: string; source?: string | null; notes?: string | null }) {
    const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    if (customer.status === 'INACTIVE') {
      throw ApiError.badRequest('CUSTOMER_INACTIVE', 'A lead cannot be opened for an inactive customer');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          customerId: input.customerId,
          source: input.source?.trim() ? input.source.trim() : null,
          notes: input.notes ?? null,
          createdById: actor.id,
        },
      });
      await tx.leadOwnership.create({
        data: {
          leadId: lead.id,
          employeeId: actor.id,
          assignedById: actor.id,
          reason: 'auto-assigned to creator',
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.LEAD,
        entityId: lead.id,
        entityLabel: customer.fullName,
        action: AuditAction.CREATED,
        after: { customerId: customer.id, source: lead.source, status: LeadStatus.OPEN },
      });
      return lead.id;
    });

    return this.detailOrThrow(id, actor);
  }

  async update(actor: AuthEmployee, id: string, input: { source?: string | null; notes?: string | null }) {
    const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null, AND: [this.scopeWhere(actor)] } });
    if (!lead) throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          source: input.source === undefined ? undefined : input.source?.trim() ? input.source.trim() : null,
          notes: input.notes === undefined ? undefined : input.notes,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.LEAD,
        entityId: id,
        entityLabel: lead.id,
        action: AuditAction.UPDATED,
        before: { source: lead.source, notes: lead.notes },
        after: { source: updated.source, notes: updated.notes },
      });
    });
    return this.detailOrThrow(id, actor);
  }

  async assign(actor: AuthEmployee, id: string, input: { employeeId: string; reason?: string }) {
    const lead = await this.prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw ApiError.notFound('LEAD_NOT_FOUND', 'Lead not found');

    const target = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
    });
    if (!target) throw ApiError.badRequest('EMPLOYEE_NOT_FOUND', 'Target employee is not active');

    const current = await this.prisma.leadOwnership.findFirst({
      where: { leadId: id, releasedAt: null },
      include: { employee: { select: { id: true, fullName: true } } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.leadOwnership.updateMany({ where: { leadId: id, releasedAt: null }, data: { releasedAt: new Date() } });
      await tx.leadOwnership.create({
        data: {
          leadId: id,
          employeeId: target.id,
          assignedById: actor.id,
          reason: input.reason?.trim() ? input.reason.trim() : null,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.LEAD,
        entityId: id,
        entityLabel: lead.id,
        action: AuditAction.OWNERSHIP_ASSIGNED,
        before: { ownerId: current?.employeeId ?? null },
        after: { ownerId: target.id, reason: input.reason ?? null },
      });
    });

    return this.detailOrThrow(id, actor);
  }

  async ownershipHistory(id: string, actor: AuthEmployee) {
    await this.detailOrThrow(id, actor); // scoping + existence
    const rows = await this.prisma.leadOwnership.findMany({
      where: { leadId: id },
      orderBy: { assignedAt: 'desc' },
      include: {
        employee: { select: { id: true, fullName: true } },
        assignedBy: { select: { id: true, fullName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      owner: row.employee,
      assignedBy: row.assignedBy,
      reason: row.reason,
      assignedAt: row.assignedAt,
      releasedAt: row.releasedAt,
      isCurrent: row.releasedAt === null,
    }));
  }

  /** Agents see only leads they currently own. (STAFF/MANAGER/FOUNDER: all.) */
  private scopeWhere(actor: AuthEmployee): Prisma.LeadWhereInput {
    if (actor.roleCode === 'AGENT') {
      return { ownerships: { some: { employeeId: actor.id, releasedAt: null } } };
    }
    return {};
  }
}

type LeadDetail = Prisma.LeadGetPayload<{ include: typeof LEAD_DETAIL_INCLUDE }>;

function serializeLead(lead: LeadDetail) {
  const ownershipHistory = lead.ownerships.map((row) => ({
    id: row.id,
    owner: row.employee,
    assignedBy: row.assignedBy,
    reason: row.reason,
    assignedAt: row.assignedAt,
    releasedAt: row.releasedAt,
    isCurrent: row.releasedAt === null,
  }));
  return {
    id: lead.id,
    customer: {
      id: lead.customer.id,
      fullName: lead.customer.fullName,
      status: lead.customer.status,
      primaryPhone: lead.customer.phones[0]?.phoneE164 ?? null,
    },
    status: lead.status,
    source: lead.source,
    notes: lead.notes,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    currentOwner: ownershipHistory.find((row) => row.isCurrent)?.owner ?? null,
    ownershipHistory,
  };
}

