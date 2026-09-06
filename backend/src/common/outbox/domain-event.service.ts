import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  type DomainEvent,
  type DomainEventType,
  DOMAIN_EVENTS,
} from '@grotec/shared';

type Db = Prisma.TransactionClient | PrismaClient;

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
export function buildIdempotencyKey(
  eventType: DomainEventType,
  aggregateId: string,
  payload: Record<string, unknown>,
): string {
  const stable: Record<string, unknown> = {};

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
      stable['ownerId'] = (payload as { ownerId?: string }).ownerId;
      break;

    case DOMAIN_EVENTS.LEAD_ASSIGNED:
    case DOMAIN_EVENTS.LEAD_REASSIGNED:
      stable['id'] = aggregateId;
      stable['ownerId'] = (payload as { ownerId?: string }).ownerId;
      break;

    case DOMAIN_EVENTS.LEAD_UPDATED:
      stable['id'] = aggregateId;
      break;

    case DOMAIN_EVENTS.RELATIONSHIP_ASSIGNED:
    case DOMAIN_EVENTS.RELATIONSHIP_REASSIGNED:
      stable['customerId'] = (payload as { customerId?: string }).customerId;
      stable['rmId'] = (payload as { rmId?: string }).rmId;
      break;

    case DOMAIN_EVENTS.RELATIONSHIP_RELEASED:
      stable['customerId'] = (payload as { customerId?: string }).customerId;
      break;

    case DOMAIN_EVENTS.EMPLOYEE_DEACTIVATED:
    case DOMAIN_EVENTS.EMPLOYEE_ACTIVATED:
      stable['employeeId'] = (payload as { employeeId?: string }).employeeId;
      break;

    case DOMAIN_EVENTS.PAYROLL_PUBLISHED:
      stable['runId'] = (payload as { runId?: string }).runId;
      break;

    default:
      // For unknown event types, use a hash of the entire payload as fallback.
      stable['_fallback'] = payload;
  }

  const hash = simpleHash(JSON.stringify(stable));
  return `${eventType}:${aggregateId}:${hash}`;
}

/** Fast non-crypto hash sufficient for idempotency-key collisions. */
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

@Injectable()
export class DomainEventService {
  private readonly logger = new Logger(DomainEventService.name);

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
  async emit(
    db: Db,
    params: {
      eventType: DomainEventType;
      aggregateType: string;
      aggregateId: string;
      actorId?: string | null;
      correlationId?: string | null;
      causationId?: string | null;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    const idempotencyKey = buildIdempotencyKey(params.eventType, params.aggregateId, params.payload);

    const eventId = randomUUID();

    const event: Omit<DomainEvent, 'schemaVersion' | 'payload'> & { schemaVersion: string; payload: unknown } = {
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
      const client = db as any;
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
    } catch (err) {
      // P2002 = unique constraint violation on idempotencyKey → already emitted.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Event already emitted (idempotency key=${idempotencyKey}), skipping`);
        return;
      }
      // Re-throw unexpected errors so the transaction rolls back.
      throw err;
    }
  }
}
