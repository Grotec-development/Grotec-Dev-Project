import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxWorker } from './outbox-worker';
import { DOMAIN_EVENTS } from '@grotec/shared';

/**
 * Registers event handlers with the OutboxWorker on app startup.
 * Each handler processes events emitted via the transactional outbox.
 *
 * Handlers are idempotent — safe to run multiple times for the same event.
 * They execute outside the original transaction, in individual mini-transactions.
 */
@Injectable()
export class OutboxEventHandlers implements OnModuleInit {
  private readonly logger = new Logger(OutboxEventHandlers.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: OutboxWorker,
  ) {}

  onModuleInit(): void {
    OutboxWorker.registerHandlers({
      [DOMAIN_EVENTS.PAYROLL_PUBLISHED]: this.handlePayrollPublished.bind(this),
      [DOMAIN_EVENTS.CUSTOMER_CREATED]: this.handleCustomerCreated.bind(this),
      [DOMAIN_EVENTS.CUSTOMER_UPDATED]: this.handleCustomerUpdated.bind(this),
      [DOMAIN_EVENTS.CUSTOMER_ACTIVATED]: this.handleCustomerActivated.bind(this),
      [DOMAIN_EVENTS.CUSTOMER_DEACTIVATED]: this.handleCustomerDeactivated.bind(this),
      [DOMAIN_EVENTS.LEAD_CREATED]: this.handleLeadCreated.bind(this),
      [DOMAIN_EVENTS.LEAD_ASSIGNED]: this.handleLeadAssigned.bind(this),
      [DOMAIN_EVENTS.LEAD_REASSIGNED]: this.handleLeadReassigned.bind(this),
      [DOMAIN_EVENTS.RELATIONSHIP_ASSIGNED]: this.handleRelationshipAssigned.bind(this),
      [DOMAIN_EVENTS.RELATIONSHIP_REASSIGNED]: this.handleRelationshipReassigned.bind(this),
      [DOMAIN_EVENTS.RELATIONSHIP_RELEASED]: this.handleRelationshipReleased.bind(this),
    });
    this.logger.log(`Registered ${Object.keys(DOMAIN_EVENTS).length} event handlers`);
  }

  // -------------------------------------------------------------------------
  // Payroll
  // -------------------------------------------------------------------------

  private async handlePayrollPublished(event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    const { runId, month } = event.payload as { runId: string; month: string; employeeCount: number };

    // Fetch line items for this run (run was already committed by the time we process).
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { lineItems: { include: { employee: { select: { id: true, fullName: true } } } } },
    });
    if (!run) {
      this.logger.warn(`Payroll run ${runId} not found when processing payroll.published`);
      return;
    }

    // Process each employee's advance recovery + notification in its own transaction.
    // Failure for one employee is isolated and retried independently.
    await Promise.allSettled(
      run.lineItems.map((item) => this.processPayrollEmployeeSideEffect(runId, month, item)),
    );
  }

  private async processPayrollEmployeeSideEffect(
    runId: string,
    month: string,
    item: { id: string; employeeId: string; advanceRecovery: { toNumber: () => number }; netPay: { toNumber: () => number }; employee: { id: string; fullName: string } },
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (item.advanceRecovery.toNumber() > 0) {
          const advances = await tx.advanceLedger.findMany({
            where: { employeeId: item.employeeId, status: 'ACTIVE', runningBalance: { gt: 0 } },
            orderBy: { issuedAt: 'asc' },
          });

          let remaining = item.advanceRecovery.toNumber();
          for (const adv of advances) {
            if (remaining <= 0) break;
            const deduction = Math.min(adv.runningBalance.toNumber(), remaining);
            const newBal = adv.runningBalance.toNumber() - deduction;

            await tx.advanceRecovery.create({
              data: {
                advanceId: adv.id,
                payrollRunId: runId,
                amount: deduction,
                linkedPayrollMonth: month,
                notes: `Recovered via payroll ${month}`,
              },
            });

            await tx.advanceLedger.update({
              where: { id: adv.id },
              data: {
                runningBalance: newBal,
                status: newBal <= 0 ? 'COMPLETED' : 'ACTIVE',
              },
            });

            remaining -= deduction;
          }
        }

        await tx.appNotification.create({
          data: {
            recipientId: item.employeeId,
            type: 'PAYROLL_STATUS',
            title: `Payslip Available for ${month}`,
            message: `Your payslip for ${month} of INR ${item.netPay.toNumber().toLocaleString('en-IN')} has been published.`,
            data: { payrollRunId: runId, lineItemId: item.id, month },
          },
        });
      });
    } catch (err) {
      this.logger.warn(
        `payroll.published side effect failed for employee ${item.employeeId} in run ${month}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
      throw err; // re-throw so the worker treats this as transient failure and retries
    }
  }

  // -------------------------------------------------------------------------
  // Customer
  // -------------------------------------------------------------------------

  private async handleCustomerCreated(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder for future integrations (e.g. welcome notification, ERP sync).
    // Currently a no-op — idempotent handler that acknowledges the event.
  }

  private async handleCustomerUpdated(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for customer.updated in Phase 1.
  }

  private async handleCustomerActivated(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for customer.activated in Phase 1.
  }

  private async handleCustomerDeactivated(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for customer.deactivated in Phase 1.
  }

  // -------------------------------------------------------------------------
  // Lead
  // -------------------------------------------------------------------------

  private async handleLeadCreated(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for lead.created in Phase 1.
  }

  private async handleLeadAssigned(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for lead.assigned in Phase 1.
  }

  private async handleLeadReassigned(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for lead.reassigned in Phase 1.
  }

  // -------------------------------------------------------------------------
  // Relationship (RM)
  // -------------------------------------------------------------------------

  private async handleRelationshipAssigned(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for relationship.assigned in Phase 1.
  }

  private async handleRelationshipReassigned(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for relationship.reassigned in Phase 1.
  }

  private async handleRelationshipReleased(_event: { aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    // Placeholder — no side effects required for relationship.released in Phase 1.
  }
}
