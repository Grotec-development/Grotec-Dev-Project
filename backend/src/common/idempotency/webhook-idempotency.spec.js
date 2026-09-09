import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    toDeterministicUuid,
    extractCanonicalEventId,
    WebhookIdempotencyService,
} from './webhook-idempotency.service';

describe('Webhook Idempotency Service (Deduplication, Concurrency, & Resilience)', () => {
    describe('toDeterministicUuid', () => {
        it('preserves existing valid RFC 4122 UUID unchanged in lowercase', () => {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            expect(toDeterministicUuid(validUuid)).toBe(validUuid.toLowerCase());
            expect(toDeterministicUuid(validUuid.toUpperCase())).toBe(validUuid.toLowerCase());
        });

        it('deterministically maps arbitrary string IDs to a valid RFC 4122 v5 UUID', () => {
            const key1 = 'dialer:mock:call-123:CONNECTED';
            const key2 = 'dialer:mock:call-123:CONNECTED';
            const key3 = 'dialer:mock:call-123:ENDED';

            const uuid1 = toDeterministicUuid(key1);
            const uuid2 = toDeterministicUuid(key2);
            const uuid3 = toDeterministicUuid(key3);

            // Valid UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuidRegex.test(uuid1)).toBe(true);
            expect(uuidRegex.test(uuid2)).toBe(true);
            expect(uuidRegex.test(uuid3)).toBe(true);

            // Deterministic: same input -> same UUID
            expect(uuid1).toBe(uuid2);

            // Distinct: different input -> different UUID
            expect(uuid1).not.toBe(uuid3);
        });

        it('throws an error for non-string or empty input', () => {
            expect(() => toDeterministicUuid('')).toThrow();
            expect(() => toDeterministicUuid(null)).toThrow();
            expect(() => toDeterministicUuid(undefined)).toThrow();
        });
    });

    describe('extractCanonicalEventId', () => {
        it('prioritizes header event ID when provided (x-event-id, x-webhook-id, x-delivery-id)', () => {
            const headers = { 'x-event-id': 'header-evt-100' };
            const payload = { eventId: 'payload-evt-200', providerCallId: 'call-1', status: 'CONNECTED' };

            const id = extractCanonicalEventId('mock', headers, payload);
            expect(id).toBe('header-evt-100');
        });

        it('uses payload eventId / id / webhookId when header is absent', () => {
            const payload = { eventId: 'payload-evt-300', providerCallId: 'call-1', status: 'CONNECTED' };
            const id = extractCanonicalEventId('mock', {}, payload);
            expect(id).toBe('payload-evt-300');
        });

        it('falls back to deterministic dialer status transition key when no eventId is provided', () => {
            const payload = { providerCallId: 'call-456', status: 'connected' };
            const id = extractCanonicalEventId('mock', {}, payload);
            expect(id).toBe('dialer:mock:call-456:CONNECTED');
        });

        it('includes sequence in dialer transition key when sequence number is present', () => {
            const payload = { providerCallId: 'call-456', status: 'connected', sequence: 3 };
            const id = extractCanonicalEventId('mock', {}, payload);
            expect(id).toBe('dialer:mock:call-456:CONNECTED:3');
        });

        it('extracts call info from provider snapshot if payload lacks providerCallId', () => {
            const payload = {};
            const snapshot = { providerCallId: 'snap-call-789', status: 'RINGING' };
            const id = extractCanonicalEventId('mock', {}, payload, snapshot);
            expect(id).toBe('dialer:mock:snap-call-789:RINGING');
        });

        it('returns null if neither eventId nor valid call transition properties exist', () => {
            expect(extractCanonicalEventId('mock', {}, {})).toBeNull();
            expect(extractCanonicalEventId('mock', {}, { foo: 'bar' })).toBeNull();
        });
    });

    describe('processIdempotent (Execution & Idempotency)', () => {
        let mockPrisma;
        let service;

        beforeEach(() => {
            mockPrisma = {
                processedEvent: {
                    findUnique: vi.fn(),
                    upsert: vi.fn(),
                    create: vi.fn(),
                },
            };
            service = new WebhookIdempotencyService(mockPrisma);
        });

        it('first delivery: executes handler, records ProcessedEvent, and returns applied: true', async () => {
            mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
            mockPrisma.processedEvent.upsert.mockResolvedValue({ id: 'proc-1' });

            const handler = vi.fn().mockResolvedValue({ success: true });

            const result = await service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: handler,
            });

            expect(handler).toHaveBeenCalledTimes(1);
            expect(result.duplicate).toBe(false);
            expect(result.applied).toBe(true);
            expect(result.result).toEqual({ success: true });

            expect(mockPrisma.processedEvent.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        eventId_consumerName: {
                            eventId: expect.any(String),
                            consumerName: 'dialer-webhook:mock',
                        },
                    },
                })
            );
        });

        it('duplicate delivery: detects existing ProcessedEvent, skips handler, returns duplicate: true', async () => {
            mockPrisma.processedEvent.findUnique.mockResolvedValue({
                id: 'existing-proc-1',
                processedAt: new Date(),
            });

            const handler = vi.fn();

            const result = await service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: handler,
            });

            expect(handler).not.toHaveBeenCalled();
            expect(result.duplicate).toBe(true);
            expect(result.applied).toBe(false);
            expect(mockPrisma.processedEvent.upsert).not.toHaveBeenCalled();
        });

        it('failed execution: does NOT record ProcessedEvent and re-throws error so vendor can retry', async () => {
            mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
            const handler = vi.fn().mockRejectedValue(new Error('Downstream DB error during sync'));

            await expect(
                service.processIdempotent({
                    consumerName: 'dialer-webhook:mock',
                    rawEventId: 'dialer:mock:call-1:CONNECTED',
                    execute: handler,
                })
            ).rejects.toThrow('Downstream DB error during sync');

            expect(mockPrisma.processedEvent.upsert).not.toHaveBeenCalled();

            // Next attempt succeeds cleanly
            mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
            mockPrisma.processedEvent.upsert.mockResolvedValue({ id: 'proc-2' });
            const retryHandler = vi.fn().mockResolvedValue({ recovered: true });

            const retryResult = await service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: retryHandler,
            });

            expect(retryHandler).toHaveBeenCalledTimes(1);
            expect(retryResult.applied).toBe(true);
        });

        it('concurrent duplicate in same process: awaits in-flight execution and deduplicates safely', async () => {
            mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
            mockPrisma.processedEvent.upsert.mockResolvedValue({ id: 'proc-1' });

            let resolveHandler;
            const handler = vi.fn().mockReturnValue(
                new Promise((resolve) => {
                    resolveHandler = resolve;
                })
            );

            // Fire first request (enters in-flight)
            const req1Promise = service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: handler,
            });

            // Fire concurrent second request (sees in-flight lock)
            const req2Promise = service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: handler,
            });

            // Unblock handler
            resolveHandler({ sync: 'done' });

            const [res1, res2] = await Promise.all([req1Promise, req2Promise]);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(res1.applied).toBe(true);
            expect(res1.duplicate).toBe(false);
            expect(res2.applied).toBe(false);
            expect(res2.duplicate).toBe(true);
        });

        it('concurrent duplicate across processes: handles DB unique constraint (P2002) as duplicate', async () => {
            mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
            // Simulate parallel worker won the race and inserted first:
            const p2002Error = new Error('Unique constraint failed on the fields: (event_id, consumer_name)');
            p2002Error.code = 'P2002';
            mockPrisma.processedEvent.upsert.mockRejectedValue(p2002Error);

            const handler = vi.fn().mockResolvedValue({ sync: 'done' });

            const result = await service.processIdempotent({
                consumerName: 'dialer-webhook:mock',
                rawEventId: 'dialer:mock:call-1:CONNECTED',
                execute: handler,
            });

            expect(result.duplicate).toBe(true);
            expect(result.applied).toBe(false);
        });
    });
});
