var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OutboxWorker_1;
var _a;
import { Injectable, Logger } from '@nestjs/common';
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
let OutboxWorker = class OutboxWorker {
    static { OutboxWorker_1 = this; }
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new Logger(OutboxWorker_1.name);
        this.running = false;
        this.timer = null;
    }
    onModuleInit() {
        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.includes('<') || dbUrl.includes('>')) {
            this.logger.warn('DATABASE_URL is not configured (contains placeholder text). OutboxWorker is suspended.');
            return;
        }
        this.running = true;
        this.schedule();
    }
    onModuleDestroy() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
    }
    schedule(immediate = false) {
        if (!this.running)
            return;
        const delay = immediate ? 0 : 2_000;
        this.timer = setTimeout(() => this.tick(), delay);
    }
    async tick() {
        if (!this.running)
            return;
        try {
            await this.processBatch();
        }
        catch (err) {
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
    async processBatch() {
        const now = new Date();
        const candidates = await this.prisma.outboxEvent.findMany({
            where: {
                OR: [
                    { status: 'PENDING', AND: [
                        { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
                        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
                    ] },
                    { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
                ],
            },
            orderBy: { createdAt: 'asc' },
            take: BATCH_SIZE,
        });
        await Promise.allSettled(candidates.map((event) => this.processEvent(event)));
    }
    async processEvent(event) {
        const now = new Date();
        const leaseExpiry = new Date(now.getTime() + LEASE_TTL_MS);
        const claimed = await this.prisma.outboxEvent.updateMany({
            where: {
                id: event.id,
                OR: [
                    { status: 'PENDING', AND: [
                        { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
                        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
                    ] },
                    { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
                ],
            },
            data: { status: 'PROCESSING', attempts: { increment: 1 }, leaseExpiresAt: leaseExpiry },
        });
        if (claimed.count === 0) return;
        const ownedClaim = { id: event.id, status: 'PROCESSING', leaseExpiresAt: leaseExpiry };
        try {
            await this.prisma.$transaction(async (tx) => {
                // Lock the claim for the entire transaction. A recovered worker cannot
                // commit effects concurrently with this owner, even after lease expiry.
                const locked = await tx.outboxEvent.updateMany({
                    where: ownedClaim, data: { leaseExpiresAt: leaseExpiry },
                });
                if (locked.count === 0) return;
                const completed = await tx.processedEvent.findUnique({
                    where: { eventId_consumerName: { eventId: event.eventId, consumerName: CONSUMER_NAME } },
                });
                if (!completed) {
                    await this.executeHandler(event, tx);
                    await tx.processedEvent.create({ data: {
                        idempotencyKey: event.idempotencyKey ?? event.eventId,
                        eventId: event.eventId, consumerName: CONSUMER_NAME,
                    } });
                }
                await tx.outboxEvent.update({ where: { id: event.id }, data: {
                    status: 'PROCESSED', processedAt: new Date(), leaseExpiresAt: null,
                    lastError: null, nextRetryAt: null,
                } });
            }, { timeout: 60_000 });
        } catch (err) {
            const attempt = event.attempts + 1;
            const failed = attempt >= (event.maxAttempts ?? 3);
            await this.prisma.outboxEvent.updateMany({ where: ownedClaim, data: {
                status: failed ? 'FAILED' : 'PENDING',
                lastError: err instanceof Error ? err.message : String(err),
                leaseExpiresAt: null,
                nextRetryAt: failed ? null : new Date(Date.now() + BASE_RETRY_DELAY_MS * 2 ** (attempt - 1)),
            } });
        }
    }
    async executeHandler(event, tx) {
        const handler = OutboxWorker_1.handlers[event.eventType];
        if (!handler) {
            // No handler — treat as handled (skip without error).
            this.logger.debug(`No handler for event type ${event.eventType}, skipping`);
            return;
        }
        await handler({
            eventId: event.eventId,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            payload: event.payload,
        }, tx);
    }
    // -------------------------------------------------------------------------
    // Handler registry
    // -------------------------------------------------------------------------
    static { this.handlers = {}; }
    static registerHandlers(map) {
        OutboxWorker_1.handlers = { ...OutboxWorker_1.handlers, ...map };
    }
    static clearHandlers() {
        OutboxWorker_1.handlers = {};
    }
};
OutboxWorker = OutboxWorker_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], OutboxWorker);
export { OutboxWorker };
