var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebhookIdempotencyService_1;
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Maps any arbitrary string identifier deterministically to an RFC 4122 v5 UUID.
 * If the string is already a valid UUID, returns it unchanged in lowercase.
 */
export function toDeterministicUuid(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') {
        throw new Error('rawKey must be a non-empty string');
    }
    const trimmed = rawKey.trim();
    if (UUID_REGEX.test(trimmed)) {
        return trimmed.toLowerCase();
    }
    const hash = crypto.createHash('sha1').update('GROTEC_IDEMPOTENCY:' + trimmed).digest('hex');
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '5' + hash.substring(13, 16),
        ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
        hash.substring(20, 32),
    ].join('-');
}

/**
 * Extracts a stable, canonical event identifier from webhook headers or payload.
 * Priority order:
 *  1. Header x-event-id / x-webhook-id / x-delivery-id
 *  2. Payload eventId / id / webhookId
 *  3. Fallback for dialer call state transitions: dialer:<providerId>:<providerCallId>:<status>
 */
export function extractCanonicalEventId(providerId, headers = {}, payload = {}, snapshot = null) {
    const h = headers || {};
    const p = (payload && typeof payload === 'object') ? payload : {};

    const headerEventId = h['x-event-id'] || h['x-webhook-id'] || h['x-delivery-id'];
    if (typeof headerEventId === 'string' && headerEventId.trim().length > 0) {
        return headerEventId.trim();
    }

    const payloadEventId = p.eventId || p.id || p.webhookId;
    if (typeof payloadEventId === 'string' && payloadEventId.trim().length > 0) {
        return payloadEventId.trim();
    }

    const providerCallId = p.providerCallId || snapshot?.providerCallId;
    const status = p.status || snapshot?.status;
    if (typeof providerCallId === 'string' && providerCallId.trim().length > 0 && status) {
        const seq = (p.sequence !== undefined && p.sequence !== null) ? ':' + p.sequence : '';
        return `dialer:${providerId}:${providerCallId.trim()}:${String(status).toUpperCase()}${seq}`;
    }

    return null;
}

let WebhookIdempotencyService = WebhookIdempotencyService_1 = class WebhookIdempotencyService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new Logger(WebhookIdempotencyService_1.name);
        /** In-flight executions to handle intra-process concurrency */
        this.inFlight = new Map();
    }

    /**
     * Executes a webhook handler idempotently.
     * Guarantees:
     *  1. Same webhook delivered twice -> processed once, returns { duplicate: true, applied: false }
     *  2. Concurrent delivery -> race-safe in-flight lock + DB unique constraint
     *  3. Failed processing -> does not mark event processed; re-throws error allowing vendor retry
     *
     * @param {Object} options
     * @param {string} options.consumerName - Consumer identifier (e.g. 'dialer-webhook:mock')
     * @param {string} options.rawEventId - Canonical event identifier
     * @param {Function} options.execute - The side-effecting handler function
     */
    async processIdempotent({ consumerName, rawEventId, execute }) {
        if (!rawEventId || typeof rawEventId !== 'string') {
            throw new Error('processIdempotent requires a non-empty string rawEventId');
        }

        const canonicalEventId = toDeterministicUuid(rawEventId);
        const lockKey = `${consumerName}:${canonicalEventId}`;

        // Check if an identical event is actively in-flight in this process
        if (this.inFlight.has(lockKey)) {
            this.logger.debug(`Webhook ${lockKey} is currently in-flight; awaiting concurrent execution`);
            try {
                await this.inFlight.get(lockKey);
                // After in-flight completes successfully, it was already applied
                return {
                    duplicate: true,
                    applied: false,
                    eventId: rawEventId,
                    canonicalEventId,
                };
            } catch (inFlightErr) {
                // In-flight run failed; allow retry attempt
            }
        }

        // Register in-flight promise synchronously before ANY async tick
        let resolveInFlight;
        let rejectInFlight;
        const inFlightPromise = new Promise((res, rej) => {
            resolveInFlight = res;
            rejectInFlight = rej;
        });
        inFlightPromise.catch(() => {}); // Prevent unhandled rejection warning in Node
        this.inFlight.set(lockKey, inFlightPromise);

        try {
            // Check ProcessedEvent table in DB
            const existing = await this.prisma.processedEvent.findUnique({
                where: {
                    eventId_consumerName: {
                        eventId: canonicalEventId,
                        consumerName,
                    },
                },
                select: { id: true, processedAt: true },
            });

            if (existing) {
                this.logger.debug(`Webhook ${lockKey} already processed at ${existing.processedAt}, skipping`);
                resolveInFlight(null);
                return {
                    duplicate: true,
                    applied: false,
                    eventId: rawEventId,
                    canonicalEventId,
                };
            }

            // STEP 1: Execute handler
            const result = await execute();

            // STEP 2: Record in ProcessedEvent table on successful execution
            try {
                await this.prisma.processedEvent.upsert({
                    where: {
                        eventId_consumerName: {
                            eventId: canonicalEventId,
                            consumerName,
                        },
                    },
                    create: {
                        idempotencyKey: rawEventId.slice(0, 120),
                        eventId: canonicalEventId,
                        consumerName,
                    },
                    update: {},
                });
            } catch (dbErr) {
                // P2002: unique constraint violation if another instance inserted in parallel
                if (dbErr && dbErr.code === 'P2002') {
                    this.logger.warn(`Concurrent duplicate write prevented by unique constraint for ${lockKey}`);
                    resolveInFlight(null);
                    return {
                        duplicate: true,
                        applied: false,
                        eventId: rawEventId,
                        canonicalEventId,
                    };
                }
                throw dbErr;
            }

            resolveInFlight(result);
            return {
                duplicate: false,
                applied: true,
                eventId: rawEventId,
                canonicalEventId,
                result,
            };
        } catch (err) {
            // Processing failed! Do NOT record ProcessedEvent. Reject in-flight and rethrow.
            rejectInFlight(err);
            throw err;
        } finally {
            this.inFlight.delete(lockKey);
        }
    }
};

WebhookIdempotencyService = WebhookIdempotencyService_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof PrismaService !== "undefined" ? PrismaService : Object])
], WebhookIdempotencyService);

export { WebhookIdempotencyService };
