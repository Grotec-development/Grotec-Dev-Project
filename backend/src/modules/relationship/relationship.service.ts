import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, DOMAIN_EVENTS, type FollowUpStatus } from '@grotec/shared';
import { Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { DomainEventService } from '../../common/outbox/domain-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const LIVE_PHONE: Prisma.CustomerPhoneWhereInput = { deletedAt: null };

/**
 * Relationship (RM) ownership — a separate concept from agent lead ownership
 * (PRD §6.4, §11). One active RM per customer (partial unique index on
 * non-released rows). Eligible RM holders are ACTIVE MANAGER-role employees;
 * the Founder supervises. Assignment/reassignment rules are provisional and
 * recorded as open items where the PRD is silent.
 */
@Injectable()
export class RelationshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventService,
  ) {}

  /**
   * RM workspace — customers under relationship ownership.
   * MANAGER: own portfolio only (ownership restriction); FOUNDER: all, with
   * optional rmId filter. `unassigned=1` lists converted customers (closed
   * leads) that have no active RM so they can be claimed/re-assigned.
   */
  async list(actor: AuthEmployee, query: { rmId?: string; q?: string; unassigned?: string } = {}) {
    const unassigned = query.unassigned === '1' || query.unassigned === 'true';

    if (actor.roleCode === 'MANAGER' && query.rmId && query.rmId !== actor.id) {
      throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only view their own portfolio');
    }
    const ownerId = actor.roleCode === 'MANAGER' ? actor.id : query.rmId;

    if (unassigned) {
      if (actor.roleCode === 'AGENT') throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Not allowed');
      return this.listUnassigned(actor, ownerId, query.q);
    }

    const rows = await this.prisma.relationshipOwnership.findMany({
      where: {
        releasedAt: null,
        ...(ownerId ? { employeeId: ownerId } : {}),
        customer: {
          is: {
            deletedAt: null,
            ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' } } : {}),
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 200,
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        customer: {
          include: {
            phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
            locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
            crops: { where: { deletedAt: null }, include: { crop: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    const items = await Promise.all(
      rows.map(async (row) => {
        const customer = row.customer;
        if (!customer) return null;
        return this.serializePortfolioRow(row.id, customer, {
          owner: { id: row.employee.id, fullName: row.employee.fullName },
          assignedAt: row.assignedAt,
          reason: row.reason,
        });
      }),
    );
    return { items: items.filter((item): item is NonNullable<typeof item> => item !== null) };
  }

  /** Employees eligible to hold RM ownership (ACTIVE MANAGER role), with load. */
  async holders(): Promise<Array<{ id: string; fullName: string; email: string; customerCount: number }>> {
    const managerRole = await this.prisma.role.findUnique({ where: { code: 'MANAGER' } });
    if (!managerRole) return [];
    const employees = await this.prisma.employee.findMany({
      where: { roleId: managerRole.id, status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
    const counts = await this.prisma.relationshipOwnership.groupBy({
      by: ['employeeId'],
      where: { releasedAt: null },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.employeeId, c._count._all]));
    return employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      customerCount: countBy.get(e.id) ?? 0,
    }));
  }

  /**
   * Assign or reassign an RM. FOUNDER may move any customer between eligible
   * holders; MANAGER may transfer customers in their own portfolio (or claim an
   * unassigned converted customer to themselves). Never touches other managers'
   * customers — ownership restrictions.
   */
  async assign(actor: AuthEmployee, customerId: string, dto: { employeeId: string; reason?: string }) {
    const customer = await this.findCustomer(customerId);
    const target = await this.findEligibleHolder(dto.employeeId);
    const active = await this.prisma.relationshipOwnership.findFirst({
      where: { customerId, releasedAt: null },
      include: { employee: { select: { id: true, fullName: true } } },
    });

    if (actor.roleCode === 'MANAGER') {
      const owns = active?.employeeId === actor.id;
      const claimSelf = !active && dto.employeeId === actor.id;
      if (!owns && !claimSelf) {
        throw ApiError.forbidden(
          'RELATIONSHIP_FORBIDDEN',
          'Managers can only reassign customers in their own portfolio or claim an unassigned customer to themselves',
        );
      }
    }
    if (active?.employeeId === target.id) {
      // Idempotent — the requested holder already owns the customer.
      return this.serializeAssignment(customerId, customer.fullName, {
        owner: { id: target.id, fullName: target.fullName },
        assignedAt: active.assignedAt,
        reason: active.reason,
      });
    }

    const reason = dto.reason?.trim() || (active ? 'reassigned' : 'conversion_claim');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.relationshipOwnership.updateMany({
          where: { customerId, releasedAt: null },
          data: { releasedAt: new Date() },
        });
        const row = await tx.relationshipOwnership.create({
          data: {
            customerId,
            employeeId: target.id,
            assignedById: actor.id,
            reason,
          },
        });
        await this.audit.record(tx, {
          actorId: actor.id,
          entityType: AuditEntityType.RELATIONSHIP_OWNERSHIP,
          entityId: row.id,
          entityLabel: customer.fullName,
          action: AuditAction.RELATIONSHIP_ASSIGNED,
          before: active ? { previousRmEmployeeId: active.employeeId } : undefined,
          after: { customerId, rmEmployeeId: target.id, reason },
        });
        await this.domainEvents.emit(tx, {
          eventType: active ? DOMAIN_EVENTS.RELATIONSHIP_REASSIGNED : DOMAIN_EVENTS.RELATIONSHIP_ASSIGNED,
          aggregateType: 'customer',
          aggregateId: customerId,
          actorId: actor.id,
          payload: {
            rmId: target.id,
            previousRmId: active?.employeeId ?? null,
            reason,
          },
        });
      });
    } catch (err) {
      // P2002 on relationship_ownership_current_customer_idx — a concurrent
      // assign raced past our pre-check and now holds the active row. The
      // transaction is rolled back automatically (no partial ownership state).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiError.conflict(
          'RELATIONSHIP_OWNERSHIP_CONFLICT',
          'Customer ownership changed concurrently; please retry',
        );
      }
      throw err;
    }
    return this.serializeAssignment(customerId, customer.fullName, {
      owner: { id: target.id, fullName: target.fullName },
      assignedAt: new Date(),
      reason,
    });
  }

  /** Release RM ownership (customer becomes unassigned). Founder: any; MANAGER: own. */
  async release(actor: AuthEmployee, customerId: string, dto: { reason?: string }) {
    const customer = await this.findCustomer(customerId);
    const active = await this.prisma.relationshipOwnership.findFirst({
      where: { customerId, releasedAt: null },
      include: { employee: { select: { id: true, fullName: true } } },
    });
    if (!active) {
      throw ApiError.conflict('RELATIONSHIP_NOT_ASSIGNED', 'This customer has no active relationship manager');
    }
    if (actor.roleCode === 'MANAGER' && active.employeeId !== actor.id) {
      throw ApiError.forbidden('RELATIONSHIP_FORBIDDEN', 'Managers can only release ownership of their own customers');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.relationshipOwnership.updateMany({
        where: { id: active.id, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: AuditEntityType.RELATIONSHIP_OWNERSHIP,
        entityId: active.id,
        entityLabel: customer.fullName,
        action: AuditAction.RELATIONSHIP_RELEASED,
        before: { customerId, rmEmployeeId: active.employeeId },
        after: { reason: dto.reason?.trim() ?? null },
      });
      await this.domainEvents.emit(tx, {
        eventType: DOMAIN_EVENTS.RELATIONSHIP_RELEASED,
        aggregateType: 'customer',
        aggregateId: customerId,
        actorId: actor.id,
        payload: {
          previousRmId: active.employeeId,
          reason: dto.reason?.trim() ?? null,
        },
      });
    });
    return { customerId, released: true, previousOwner: active.employee };
  }

  // ------------------------------------------------------------------ helpers

  private async listUnassigned(_actor: AuthEmployee, ownerId: string | undefined, q?: string) {
    // Converted-but-unowned: customers whose latest non-deleted lead is CLOSED
    // (or that have an RM ownership history but no active row) with no active RM.
    const closedLeadCustomers = await this.prisma.lead.findMany({
      where: { deletedAt: null, status: 'CLOSED' },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const ids = [...new Set(closedLeadCustomers.map((l) => l.customerId))];
    if (ids.length === 0) return { items: [] };

    const withOwner = await this.prisma.relationshipOwnership.findMany({
      where: { customerId: { in: ids }, releasedAt: null },
      select: { customerId: true },
    });
    const owned = new Set(withOwner.map((r) => r.customerId));
    const unownedIds = ids.filter((id) => !owned.has(id));

    // Manager claim scope: only themselves as target are relevant here, but the
    // list itself is shared (manager sees all unassigned converted customers).
    void ownerId;

    const customers = await this.prisma.customer.findMany({
      where: {
        id: { in: unownedIds },
        deletedAt: null,
        ...(q ? { fullName: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        crops: { where: { deletedAt: null }, include: { crop: { select: { id: true, name: true } } } },
        leads: {
          where: { deletedAt: null, status: 'CLOSED' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    const items = await Promise.all(
      customers.map(async (customer) => {
        const row = await this.serializePortfolioRow(null, customer, {
          owner: null,
          assignedAt: null,
          reason: null,
          convertedAt: customer.leads[0]?.updatedAt ?? null,
        });
        return row;
      }),
    );
    return { items };
  }

  private async serializePortfolioRow(
    ownershipRowId: string | null,
    customer: {
      id: string;
      farmerCode: string | null;
      fullName: string;
      status: string;
      phones: Array<{ phoneE164: string; isPrimary: boolean }>;
      locations: Array<{ village: string | null; taluk: string | null; district: string | null; state: string | null; isPrimary: boolean }>;
      crops: Array<{ id: string; acreage: Prisma.Decimal; unit: string; crop: { id: string; name: string } }>;
    },
    ownership: {
      owner: { id: string; fullName: string } | null;
      assignedAt: Date | null;
      reason: string | null;
      convertedAt?: Date | null;
    },
  ) {
    const primaryPhone = customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
    const location = customer.locations.find((l) => l.isPrimary) ?? customer.locations[0];
    const [pendingFollowUps, lastCall] = await Promise.all([
      this.prisma.followUp.count({
        where: { customerId: customer.id, status: 'PENDING' as FollowUpStatus },
      }),
      this.prisma.call.findFirst({
        where: { customerId: customer.id },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, outcome: true, nextAction: true, startedAt: true, phoneNumber: true },
      }),
    ]);
    return {
      ownershipRowId,
      customer: {
        id: customer.id,
        farmerCode: customer.farmerCode,
        fullName: customer.fullName,
        status: customer.status,
        primaryPhone: primaryPhone?.phoneE164 ?? null,
        location: location
          ? { village: location.village, taluk: location.taluk, district: location.district, state: location.state }
          : null,
        crops: customer.crops.map((c) => ({ id: c.id, cropId: c.crop.id, name: c.crop.name, acreage: c.acreage.toNumber(), unit: c.unit })),
      },
      owner: ownership.owner,
      assignedAt: ownership.assignedAt,
      reason: ownership.reason,
      convertedAt: ownership.convertedAt ?? null,
      pendingFollowUps,
      lastCall,
    };
  }

  private serializeAssignment(
    customerId: string,
    customerName: string,
    ownership: { owner: { id: string; fullName: string }; assignedAt: Date; reason: string | null },
  ) {
    return {
      customerId,
      customerName,
      owner: ownership.owner,
      assignedAt: ownership.assignedAt,
      reason: ownership.reason,
    };
  }

  private async findCustomer(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    return customer;
  }

  private async findEligibleHolder(employeeId: string) {
    const managerRole = await this.prisma.role.findUnique({ where: { code: 'MANAGER' } });
    const employee = managerRole
      ? await this.prisma.employee.findFirst({
          where: { id: employeeId, roleId: managerRole.id, status: 'ACTIVE' },
          select: { id: true, fullName: true },
        })
      : null;
    if (!employee) {
      throw ApiError.badRequest('INVALID_RM_HOLDER', 'Only active Manager-role employees can hold relationship ownership');
    }
    return employee;
  }
}
