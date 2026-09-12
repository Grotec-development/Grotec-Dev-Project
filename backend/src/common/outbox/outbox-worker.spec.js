import { describe, it, expect, vi } from 'vitest';
import { OutboxWorker } from './outbox-worker';
import { OutboxEventHandlers } from './event-handlers';

function fixture() {
    let row = { id: '1', eventId: 'e1', eventType: 'test', status: 'PENDING', attempts: 0, leaseExpiresAt: null };
    let marker = null;
    let effects = [];
    const db = {
        outboxEvent: {
            findMany: vi.fn(async () => [{ ...row }]),
            updateMany: vi.fn(async ({ where, data }) => {
                if (where.status && (row.status !== where.status || +row.leaseExpiresAt !== +where.leaseExpiresAt)) return { count: 0 };
                if (where.OR && row.status === 'PROCESSED') return { count: 0 };
                row = { ...row, ...data, attempts: data.attempts?.increment ? row.attempts + 1 : row.attempts };
                return { count: 1 };
            }),
            update: vi.fn(async ({ data }) => { row = { ...row, ...data }; }),
        },
        processedEvent: {
            findUnique: vi.fn(async () => marker),
            create: vi.fn(async ({ data }) => { marker = data; }),
        },
        effect: () => effects.push('effect'),
        $transaction: async (fn) => {
            const before = { row: { ...row }, marker, effects: [...effects] };
            try { return await fn(db); } catch (err) {
                row = before.row; marker = before.marker; effects = before.effects; throw err;
            }
        },
    };
    return { db, worker: new OutboxWorker(db), state: () => ({ row, marker, effects }) };
}

describe('outbox atomic completion', () => {
    it('rolls back effects on failure, retries, and prevents duplicate delivery', async () => {
        const f = fixture();
        f.worker.executeHandler = vi.fn(async (_, tx) => { tx.effect(); throw Error('temporary'); });
        await f.worker.processEvent({ ...f.state().row });
        expect(f.state()).toMatchObject({ row: { status: 'PENDING' }, marker: null, effects: [] });
        f.worker.executeHandler.mockImplementation(async (_, tx) => tx.effect());
        await f.worker.processEvent({ ...f.state().row });
        expect(f.state()).toMatchObject({ row: { status: 'PROCESSED' }, effects: ['effect'] });
        expect(f.state().marker).not.toBeNull();
        await f.worker.processEvent({ ...f.state().row });
        expect(f.worker.executeHandler).toHaveBeenCalledTimes(2);
    });
    it('includes expired processing claims in recovery batches', async () => {
        const f = fixture();
        f.worker.processEvent = vi.fn();
        await f.worker.processBatch();
        expect(f.db.outboxEvent.findMany.mock.calls[0][0].where.OR).toContainEqual({ status: 'PROCESSING', leaseExpiresAt: { lte: expect.any(Date) } });
    });
    it('propagates payroll employee failures using the worker transaction', async () => {
        const tx = { payrollRun: { findUnique: vi.fn(async () => ({ lineItems: [{ id: 'a' }, { id: 'b' }] })) } };
        const handlers = new OutboxEventHandlers({}, {});
        handlers.processPayrollEmployeeSideEffect = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('failed'));
        await expect(handlers.handlePayrollPublished({ payload: { runId: 'r', month: '2026-09' } }, tx)).rejects.toThrow('failed');
        expect(handlers.processPayrollEmployeeSideEffect).toHaveBeenLastCalledWith('r', '2026-09', { id: 'b' }, tx);
    });
});
