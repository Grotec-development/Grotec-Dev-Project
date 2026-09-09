import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialerWebhookController } from './dialer-webhook.controller';
import { ApiError } from '../../common/errors/api-error';

describe('DialerWebhookController (Security, Routing, Idempotency & Logging)', () => {
    let controller;
    let mockDialers;
    let mockCallsService;
    let mockConfigService;
    let mockIdempotencyService;
    let mockProvider;

    beforeEach(() => {
        mockProvider = {
            handleWebhook: vi.fn(),
        };

        mockDialers = {
            has: vi.fn().mockReturnValue(true),
            get: vi.fn().mockReturnValue(mockProvider),
        };

        mockCallsService = {
            syncSnapshotFromWebhook: vi.fn().mockResolvedValue(undefined),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue('test-webhook-secret'),
        };

        mockIdempotencyService = {
            processIdempotent: vi.fn().mockImplementation(async ({ execute, rawEventId }) => {
                const result = await execute();
                return { duplicate: false, applied: true, rawEventId, result };
            }),
        };

        controller = new DialerWebhookController(
            mockDialers,
            mockCallsService,
            mockConfigService,
            mockIdempotencyService
        );
    });

    describe('Webhook Authentication & Guarding', () => {
        it('throws 503 WEBHOOKS_DISABLED if DIALER_WEBHOOK_SECRET is not configured', async () => {
            mockConfigService.get.mockReturnValue(null);

            await expect(
                controller.webhook('mock', 'test-webhook-secret', { providerCallId: 'c1', status: 'CONNECTED' })
            ).rejects.toThrow(ApiError);

            await expect(
                controller.webhook('mock', 'test-webhook-secret', { providerCallId: 'c1', status: 'CONNECTED' })
            ).rejects.toMatchObject({ status: 503, code: 'WEBHOOKS_DISABLED' });
        });

        it('throws 401 INVALID_WEBHOOK_SECRET if secret does not match expected', async () => {
            await expect(
                controller.webhook('mock', 'wrong-secret', { providerCallId: 'c1', status: 'CONNECTED' })
            ).rejects.toMatchObject({ status: 401, code: 'INVALID_WEBHOOK_SECRET' });

            await expect(
                controller.webhook('mock', undefined, { providerCallId: 'c1', status: 'CONNECTED' })
            ).rejects.toMatchObject({ status: 401, code: 'INVALID_WEBHOOK_SECRET' });
        });

        it('throws 404 PROVIDER_NOT_FOUND if provider is not registered in registry', async () => {
            mockDialers.has.mockReturnValue(false);

            await expect(
                controller.webhook('unknown-tel', 'test-webhook-secret', { providerCallId: 'c1', status: 'CONNECTED' })
            ).rejects.toMatchObject({ status: 404, code: 'PROVIDER_NOT_FOUND' });
        });
    });

    describe('Payload Handling & Provider Dispatch', () => {
        it('returns ignored: true if provider does not support webhooks', async () => {
            mockDialers.get.mockReturnValue({}); // No handleWebhook method

            const response = await controller.webhook('mock', 'test-webhook-secret', { providerCallId: 'c1' });

            expect(response).toEqual({
                received: true,
                ignored: true,
                reason: 'provider does not accept webhooks',
            });
            expect(mockCallsService.syncSnapshotFromWebhook).not.toHaveBeenCalled();
        });

        it('returns ignored: true if provider rejects payload as unrecognized call', async () => {
            mockProvider.handleWebhook.mockResolvedValue(null);

            const response = await controller.webhook('mock', 'test-webhook-secret', { providerCallId: 'no-such-call' });

            expect(response).toEqual({
                received: true,
                ignored: true,
                reason: 'unrecognized provider call',
            });
            expect(mockCallsService.syncSnapshotFromWebhook).not.toHaveBeenCalled();
        });

        it('throws 400 INVALID_PAYLOAD if payload lacks both eventId and call identifiers', async () => {
            mockProvider.handleWebhook.mockResolvedValue({}); // empty snapshot

            await expect(
                controller.webhook('mock', 'test-webhook-secret', {})
            ).rejects.toMatchObject({ status: 400, code: 'INVALID_PAYLOAD' });
        });
    });

    describe('Idempotent Execution & Deduplication', () => {
        it('first delivery: processes successfully and returns applied: true', async () => {
            const snapshot = { providerCallId: 'call-100', status: 'CONNECTED' };
            mockProvider.handleWebhook.mockResolvedValue(snapshot);

            const response = await controller.webhook(
                'mock',
                'test-webhook-secret',
                { providerCallId: 'call-100', status: 'CONNECTED' },
                'req-custom-1',
                'evt-custom-1'
            );

            expect(response).toEqual({ received: true, applied: true });
            expect(mockCallsService.syncSnapshotFromWebhook).toHaveBeenCalledWith('mock', snapshot);
            expect(mockIdempotencyService.processIdempotent).toHaveBeenCalledWith(
                expect.objectContaining({
                    consumerName: 'dialer-webhook:mock',
                    rawEventId: 'evt-custom-1',
                })
            );
        });

        it('duplicate delivery: returns duplicate: true, applied: false and skips side-effects', async () => {
            const snapshot = { providerCallId: 'call-100', status: 'CONNECTED' };
            mockProvider.handleWebhook.mockResolvedValue(snapshot);

            mockIdempotencyService.processIdempotent.mockResolvedValue({
                duplicate: true,
                applied: false,
                canonicalEventId: 'ce04bdf7-f619-598a-a02b-c067330fe347',
            });

            const response = await controller.webhook(
                'mock',
                'test-webhook-secret',
                { providerCallId: 'call-100', status: 'CONNECTED' }
            );

            expect(response).toEqual({ received: true, duplicate: true, applied: false });
            expect(mockCallsService.syncSnapshotFromWebhook).not.toHaveBeenCalled();
        });
    });
});
