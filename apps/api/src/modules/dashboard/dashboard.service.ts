import { Injectable } from '@nestjs/common';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Telecaller dashboard summary — every number is computed from real CRM data
 * (PRD §6.2, Month 5). Agents get their own workload; Manager/Founder get the
 * team view. No mocked metrics.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(actor: AuthEmployee) {
    const isAgent = actor.roleCode === 'AGENT';
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const callWhere = (extra: Record<string, unknown> = {}) => ({
      ...extra,
      ...(isAgent ? { agentId: actor.id } : {}),
    });

    const [dialedToday, connectedToday, endedToday, notAnsweredToday] = await Promise.all([
      this.prisma.call.count({ where: callWhere({ startedAt: { gte: startOfToday } }) }),
      // "Connected" = a conversation that happened (ended by the agent after connecting).
      this.prisma.call.count({ where: callWhere({ startedAt: { gte: startOfToday }, status: 'ENDED', connectedAt: { not: null } }) }),
      this.prisma.call.count({ where: callWhere({ startedAt: { gte: startOfToday }, status: 'ENDED', endedAt: { not: null } }) }),
      this.prisma.call.count({ where: callWhere({ startedAt: { gte: startOfToday }, status: 'NOT_ANSWERED' }) }),
    ]);

    const followUpWhere = (extra: Record<string, unknown> = {}) => ({
      ...extra,
      ...(isAgent ? { agentId: actor.id } : {}),
    });
    const [pendingFollowUps, overdueFollowUps, dueTodayFollowUps, completedTodayFollowUps] = await Promise.all([
      this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING' }) }),
      this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING', dueAt: { lt: new Date() } }) }),
      this.prisma.followUp.count({ where: followUpWhere({ status: 'PENDING', dueAt: { gte: startOfToday, lt: startOfTomorrow } }) }),
      this.prisma.followUp.count({ where: followUpWhere({ status: 'COMPLETED', completedAt: { gte: startOfToday } }) }),
    ]);

    const ownedLeadWhere = (extra: Record<string, unknown>) => ({
      deletedAt: null,
      ...(isAgent ? { ownerships: { some: { employeeId: actor.id } } } : {}),
      ...extra,
    });
    const openLeadsWhere = ownedLeadWhere(
      isAgent ? { status: 'OPEN', ownerships: { some: { employeeId: actor.id, releasedAt: null } } } : { status: 'OPEN' },
    );
    const closedLeadsWhere = ownedLeadWhere({ status: 'CLOSED' });
    const newLeadsWhere = ownedLeadWhere(
      isAgent
        ? { createdAt: { gte: weekAgo }, ownerships: { some: { employeeId: actor.id, releasedAt: null } } }
        : { createdAt: { gte: weekAgo } },
    );

    const [openLeads, closedLeads, newLeads, customersTotal, convertedCustomers, interestedCustomers] = await Promise.all([
      this.prisma.lead.count({ where: openLeadsWhere as never }),
      this.prisma.lead.count({ where: closedLeadsWhere as never }),
      this.prisma.lead.count({ where: newLeadsWhere as never }),
      this.countVisibleCustomers(actor),
      this.countConvertedCustomers(actor),
      this.countInterestedCustomers(actor),
    ]);

    const recent = await this.prisma.call.findMany({
      where: callWhere(),
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        phoneNumber: true,
        status: true,
        outcome: true,
        startedAt: true,
        customer: { select: { fullName: true } },
      },
    });

    return {
      scope: isAgent ? 'me' : 'team',
      calls: {
        dialedToday,
        connectedToday,
        completedToday: endedToday,
        notAnsweredToday,
      },
      followUps: {
        pending: pendingFollowUps,
        overdue: overdueFollowUps,
        dueToday: dueTodayFollowUps,
        completedToday: completedTodayFollowUps,
      },
      leads: {
        open: openLeads,
        closedTotal: closedLeads,
        newThisWeek: newLeads,
      },
      customers: {
        total: customersTotal,
        converted: convertedCustomers,
        interested: interestedCustomers,
      },
      recentActivity: recent.map((call) => ({
        kind: 'call',
        id: call.id,
        customerName: call.customer?.fullName ?? null,
        phoneNumber: call.phoneNumber,
        status: call.status,
        outcome: call.outcome,
        startedAt: call.startedAt,
      })),
    };
  }

  private async countVisibleCustomers(actor: AuthEmployee): Promise<number> {
    if (actor.roleCode === 'AGENT') {
      return this.prisma.customer.count({
        where: {
          deletedAt: null,
          OR: [
            { createdById: actor.id },
            { leads: { some: { deletedAt: null, ownerships: { some: { employeeId: actor.id, releasedAt: null } } } } },
          ],
        },
      });
    }
    return this.prisma.customer.count({ where: { deletedAt: null } });
  }

  /** Customers converted to relationship ownership (active RM row). */
  private async countConvertedCustomers(actor: AuthEmployee): Promise<number> {
    if (actor.roleCode === 'AGENT') {
      // Farmers the agent moved to sales: customers with a CLOSED lead this
      // agent historically owned (lead ownership history is append-only).
      const customerIds = await this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          status: 'CLOSED',
          ownerships: { some: { employeeId: actor.id } },
        },
        distinct: ['customerId'],
        select: { customerId: true },
      });
      return customerIds.length;
    }
    return this.prisma.relationshipOwnership.count({ where: { releasedAt: null } });
  }

  /** Distinct customers with at least one Interested call outcome. */
  private async countInterestedCustomers(actor: AuthEmployee): Promise<number> {
    const calls = await this.prisma.call.findMany({
      where: {
        outcome: 'INTERESTED',
        ...(actor.roleCode === 'AGENT' ? { agentId: actor.id } : {}),
      },
      distinct: ['customerId'],
      select: { customerId: true },
    });
    return calls.filter((c) => c.customerId !== null).length;
  }
}
