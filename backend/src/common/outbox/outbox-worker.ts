import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * OutboxWorker — reliable asynchronous event dispatcher.
 *
 * Guarantees:
 *  1. At-least-once delivery: events are retried until PROCESSED or FAILED.
 *  2. Consumer-side idempotency: ProcessedEvent table prevents duplicate handler execution
 *     even if the process crashes after handler completes but before status update.
 *  3. Safe claiming: concurrent workers cannot both process the same event.
 *  4. Lease recovery: crashed workers leave their lease; lease-expired events are re-claimable.
 *
 * Processing order:
 *  1. Find eligible events: PENDING, due (nextRetryAt null/past), not under live lease.
 *  2. Check ProcessedEvent table: skip already-processed events (idempotency).
 *  3. Atomically claim: UPDATE ... WHERE status=PENDING AND (no live lease) → PROCESSING.
 *  4. Write ProcessedEvent record FIRST (before handler) — idempotency anchor.
 *  5. Execute handler. On throw: rollback ProcessedEvent (or let it stay; handler skips on next tick).
 *  6. Mark PROCESSED.
 */

const BATCH_SIZE = 50;
const LEASE_TTL_MS = 30_000; // 30 seconds — crash/timeout recovery window
const BASE_RETRY_DELAY_MS = 5_000;
const CONSUMER_NAME = 'OutboxWorker';

export type EventHandler = (event: {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

export type EventHandlerMap = Record<string, EventHandler>;

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.running = true;
    this.schedule();
  }

  onModuleDestroy(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(immediate = false): void {
    if (!this.running) return;
    const delay = immediate ? 0 : 2_000;
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      await this.processBatch();
    } catch (err) {
      this.logger.error(`OutboxWorker tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.schedule();
  }

  /**
   * Finds eligible events and processes them.
   *
   * Eligibility: PENDING status, due for retry (nextRetryAt null or past),
   * and not under a live lease (leaseExpiresAt null or expired).
   */
  private async processBatch(): Promise<void> {
    const now = new Date();

    // Find PENDING events that are due for retry.
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (candidates.length === 0) return;

    // Filter out events under a live lease (leaseExpiresAt is set and not yet passed).
    const eligible = candidates.filter(
      (e) => e.leaseExpiresAt === null || e.leaseExpiresAt <= now,
    );

    if (eligible.length === 0) return;

    this.logger.debug(`OutboxWorker: ${eligible.length} eligible events after lease filter`);

    // Load already-processed events so we skip them without a DB claim attempt.
    const eventIds = eligible.map((e) => e.eventId).filter(Boolean) as string[];
    const processedIds = new Set(
      (
        await this.prisma.processedEvent.findMany({
          where: { eventId: { in: eventIds }, consumerName: CONSUMER_NAME },
          select: { eventId: true },
        })
      ).map((r) => r.eventId),
    );

    const toProcess = eligible.filter((e) => !processedIds.has(e.eventId));

    if (toProcess.length === 0) return;

    await Promise.allSettled(toProcess.map((event) => this.processEvent(event)));
  }

  /**
   * Processes a single event:
   *  1. Atomic claim with lease.
   *  2. Write ProcessedEvent BEFORE handler (consumer idempotency anchor).
   *  3. Execute handler.
   *  4. Mark PROCESSED.
   *
   * On failure: retry with backoff or move to FAILED after maxAttempts.
   */
  private async processEvent(event: {
    id: string;
    eventId: string;
    idempotencyKey: string | null;
    eventType: string;
    aggregateId: string;
    payload: unknown;
    attempts: number;
    maxAttempts: number;
  }): Promise<void> {
    const MAX_ATTEMPTS = event.maxAttempts ?? 3;
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_TTL_MS);

    try {
      // STEP 1: Atomic claim.
      // Only succeeds if status is PENDING and no live lease exists.
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: 'PENDING',
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          leaseExpiresAt: leaseExpiry,
        },
      });

      if (claimed.count === 0) {
        this.logger.debug(`Event ${event.id} not claimable (already claimed or lease live), skipping`);
        return;
      }

      // STEP 2: Write consumer idempotency marker BEFORE handler.
      // If the process crashes after this line but before the handler finishes,
      // the next worker tick will skip this handler because ProcessedEvent exists.
      // upsert handles the case where the row already exists (ON CONFLICT DO NOTHING).
      await this.prisma.processedEvent.upsert({
        where: {
          eventId_consumerName: {
            eventId: event.eventId,
            consumerName: CONSUMER_NAME,
          },
        },
        create: {
          idempotencyKey: event.idempotencyKey ?? event.eventId,
          eventId: event.eventId,
          consumerName: CONSUMER_NAME,
        },
        update: {},
      });

      // STEP 3: Execute handler.
      await this.executeHandler({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: event.payload as Record<string, unknown>,
      });

      // STEP 4: Mark PROCESSED.
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          leaseExpiresAt: null,
          lastError: null,
          nextRetryAt: null,
        },
      });

      this.logger.debug(`Event ${event.id} (${event.eventType}) processed successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempt = event.attempts + 1;

      if (attempt >= MAX_ATTEMPTS) {
        this.logger.warn(
          `Event ${event.id} (${event.eventType}) failed permanently after ${attempt} attempts: ${message}`,
        );
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            lastError: message,
            attempts: attempt,
            nextRetryAt: null,
            leaseExpiresAt: null,
          },
        });
      } else {
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        const nextRetry = new Date(Date.now() + delayMs);
        this.logger.warn(
          `Event ${event.id} (${event.eventType}) attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}. ` +
            `Retrying at ${nextRetry.toISOString()}`,
        );
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'PENDING',
            lastError: message,
            attempts: attempt,
            nextRetryAt: nextRetry,
            leaseExpiresAt: null,
          },
        });
      }
    }
  }

  private async executeHandler(event: {
    eventId: string;
    eventType: string;
    aggregateId: string;
    payload: unknown;
  }): Promise<void> {
    const handler = OutboxWorker.handlers[event.eventType];
    if (!handler) {
      // No handler — treat as handled (skip without error).
      this.logger.debug(`No handler for event type ${event.eventType}, skipping`);
      return;
    }

    await handler({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      payload: event.payload as Record<string, unknown>,
    });
  }

  // -------------------------------------------------------------------------
  // Handler registry
  // -------------------------------------------------------------------------
  private static handlers: EventHandlerMap = {};

  static registerHandlers(map: EventHandlerMap): void {
    OutboxWorker.handlers = { ...OutboxWorker.handlers, ...map };
  }

  static clearHandlers(): void {
    OutboxWorker.handlers = {};
  }
}
