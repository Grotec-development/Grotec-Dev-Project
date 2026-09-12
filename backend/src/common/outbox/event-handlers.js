var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OutboxEventHandlers_1;
var _a, _b;
import { Injectable, Logger } from '@nestjs/common';
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
let OutboxEventHandlers = OutboxEventHandlers_1 = class OutboxEventHandlers {
    constructor(prisma, worker) {
        this.prisma = prisma;
        this.worker = worker;
        this.logger = new Logger(OutboxEventHandlers_1.name);
    }
    onModuleInit() {
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
    async handlePayrollPublished(event, tx) {
        const { runId, month } = event.payload;
        // Fetch line items for this run (run was already committed by the time we process).
        const run = await tx.payrollRun.findUnique({
            where: { id: runId },
            include: { lineItems: { orderBy: { employeeId: 'asc' }, include: { employee: { select: { id: true, fullName: true } } } } },
        });
        if (!run) {
            throw new Error(`Payroll run ${runId} not found when processing payroll.published`);
        }
        // Fail the event if any employee fails; the worker rolls back all effects.
        for (const item of run.lineItems) {
            await this.processPayrollEmployeeSideEffect(runId, month, item, tx);
        }
    }
    async processPayrollEmployeeSideEffect(runId, month, item, tx) {
        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${item.employeeId}::uuid FOR UPDATE`;
        if (item.advanceRecovery.toNumber() > 0) {
            const advances = await tx.advanceLedger.findMany({
                where: { employeeId: item.employeeId, status: 'ACTIVE', runningBalance: { gt: 0 } },
                orderBy: { issuedAt: 'asc' },
            });
            let remaining = item.advanceRecovery.toNumber();
            for (const adv of advances) {
                if (remaining <= 0)
                    break;
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
    }
    // -------------------------------------------------------------------------
    // Customer
    // -------------------------------------------------------------------------
    async handleCustomerCreated(_event) {
        // Placeholder for future integrations (e.g. welcome notification, ERP sync).
        // Currently a no-op — idempotent handler that acknowledges the event.
    }
    async handleCustomerUpdated(_event) {
        // Placeholder — no side effects required for customer.updated in Phase 1.
    }
    async handleCustomerActivated(_event) {
        // Placeholder — no side effects required for customer.activated in Phase 1.
    }
    async handleCustomerDeactivated(_event) {
        // Placeholder — no side effects required for customer.deactivated in Phase 1.
    }
    // -------------------------------------------------------------------------
    // Lead
    // -------------------------------------------------------------------------
    async handleLeadCreated(_event) {
        // Placeholder — no side effects required for lead.created in Phase 1.
    }
    async handleLeadAssigned(_event) {
        // Placeholder — no side effects required for lead.assigned in Phase 1.
    }
    async handleLeadReassigned(_event) {
        // Placeholder — no side effects required for lead.reassigned in Phase 1.
    }
    // -------------------------------------------------------------------------
    // Relationship (RM)
    // -------------------------------------------------------------------------
    async handleRelationshipAssigned(_event) {
        // Placeholder — no side effects required for relationship.assigned in Phase 1.
    }
    async handleRelationshipReassigned(_event) {
        // Placeholder — no side effects required for relationship.reassigned in Phase 1.
    }
    async handleRelationshipReleased(_event) {
        // Placeholder — no side effects required for relationship.released in Phase 1.
    }
};
OutboxEventHandlers = OutboxEventHandlers_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof OutboxWorker !== "undefined" && OutboxWorker) === "function" ? _b : Object])
], OutboxEventHandlers);
export { OutboxEventHandlers };
