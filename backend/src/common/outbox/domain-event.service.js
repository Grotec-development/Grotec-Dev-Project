var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DomainEventService_1;
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DOMAIN_EVENTS, } from '@grotec/shared';
const CURRENT_VERSION = '1.0';
/**
 * Builds a stable idempotency key for a domain event.
 *
 * Format:  `<eventType>:<aggregateId>:<stable-payload-hash>`
 *
 * The payload hash covers only the fields that identify the logical uniqueness
 * of the event (e.g. ownerId for an assignment, not timestamps). This means a
 * retried emit of the same logical event produces the same key.
 *
 * Returns null when idempotency is not applicable (e.g. ad-hoc system events).
 */
export function buildIdempotencyKey(eventType, aggregateId, payload) {
    const stable = {};
    // Event-specific stable fields — must be present in every event type that
    // uses idempotency so re-emits (e.g. retry after partial failure) collapse.
    switch (eventType) {
        case DOMAIN_EVENTS.CUSTOMER_CREATED:
        case DOMAIN_EVENTS.CUSTOMER_UPDATED:
        case DOMAIN_EVENTS.CUSTOMER_ACTIVATED:
        case DOMAIN_EVENTS.CUSTOMER_DEACTIVATED:
            stable['id'] = aggregateId;
            break;
        case DOMAIN_EVENTS.LEAD_CREATED:
            stable['id'] = aggregateId;
            stable['ownerId'] = payload.ownerId;
            break;
        case DOMAIN_EVENTS.LEAD_ASSIGNED:
        case DOMAIN_EVENTS.LEAD_REASSIGNED:
            stable['id'] = aggregateId;
            stable['ownerId'] = payload.ownerId;
            break;
        case DOMAIN_EVENTS.LEAD_UPDATED:
            stable['id'] = aggregateId;
            break;
        case DOMAIN_EVENTS.RELATIONSHIP_ASSIGNED:
        case DOMAIN_EVENTS.RELATIONSHIP_REASSIGNED:
            stable['customerId'] = payload.customerId;
            stable['rmId'] = payload.rmId;
            break;
        case DOMAIN_EVENTS.RELATIONSHIP_RELEASED:
            stable['customerId'] = payload.customerId;
            break;
        case DOMAIN_EVENTS.EMPLOYEE_DEACTIVATED:
        case DOMAIN_EVENTS.EMPLOYEE_ACTIVATED:
            stable['employeeId'] = payload.employeeId;
            break;
        case DOMAIN_EVENTS.PAYROLL_PUBLISHED:
            stable['runId'] = payload.runId;
            break;
        default:
            // For unknown event types, use a hash of the entire payload as fallback.
            stable['_fallback'] = payload;
    }
    const hash = simpleHash(JSON.stringify(stable));
    return `${eventType}:${aggregateId}:${hash}`;
}
/** Fast non-crypto hash sufficient for idempotency-key collisions. */
function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        // eslint-disable-next-line no-bitwise
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
}
let DomainEventService = DomainEventService_1 = class DomainEventService {
    constructor() {
        this.logger = new Logger(DomainEventService_1.name);
    }
    /**
     * Emits a domain event by appending it to the outbox within the same transaction
     * as the caller-provided `db` client.
     *
     * If the idempotency key already exists (a previous emit for the same logical event
     * committed), the write is silently skipped — exactly-once emission semantics.
     *
     * Callers pass their active transaction client so the event is co-committed with
     * the domain mutation:
     *
     * ```ts
     * await prisma.$transaction(async (tx) => {
     *   await tx.customer.create({ ... });
     *   await domainEvents.emit(tx, { eventType: 'customer.created', ... });
     * });
     * ```
     */
    async emit(db, params) {
        const idempotencyKey = buildIdempotencyKey(params.eventType, params.aggregateId, params.payload);
        const eventId = randomUUID();
        const event = {
            eventId,
            eventType: params.eventType,
            aggregateType: params.aggregateType,
            aggregateId: params.aggregateId,
            occurredAt: new Date().toISOString(),
            actorId: params.actorId ?? null,
            correlationId: params.correlationId ?? null,
            causationId: params.causationId ?? null,
            schemaVersion: CURRENT_VERSION,
            payload: params.payload,
        };
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = db;
            await client.outboxEvent.create({
                data: {
                    idempotencyKey,
                    eventId,
                    eventType: event.eventType,
                    aggregateType: event.aggregateType,
                    aggregateId: event.aggregateId,
                    payload: event.payload,
                    status: 'PENDING',
                },
            });
        }
        catch (err) {
            // P2002 = unique constraint violation on idempotencyKey → already emitted.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                this.logger.debug(`Event already emitted (idempotency key=${idempotencyKey}), skipping`);
                return;
            }
            // Re-throw unexpected errors so the transaction rolls back.
            throw err;
        }
    }
};
DomainEventService = DomainEventService_1 = __decorate([
    Injectable()
], DomainEventService);
export { DomainEventService };
