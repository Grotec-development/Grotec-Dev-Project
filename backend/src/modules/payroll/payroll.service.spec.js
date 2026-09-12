import { describe, it, expect, vi } from 'vitest';
import { PayrollService } from './payroll.service';

function fixture(isUnpaid, daysCount = 1) {
    const revision = { id: 'rev', baseSalary: 30000, components: { basic: 30000 } };
    const employee = { id: 'agent', salaryRevisions: [revision], advances: [], attendanceRecords: [{ date: new Date('2026-09-10'), status: 'LEAVE' }], leaveApplications: isUnpaid ? [{ startDate: new Date('2026-09-10'), endDate: new Date('2026-09-10'), daysCount }] : [] };
    const db = {
        employee: { findMany: vi.fn(async () => [employee]) },
        payrollRun: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({ id: 'run' })), update: vi.fn(async ({ data }) => ({ id: 'run', ...data })) },
        payrollLineItem: { deleteMany: vi.fn(), create: vi.fn() },
    };
    db.$transaction = fn => fn(db);
    return { db, service: new PayrollService(db, { record: vi.fn() }, {}) };
}
describe('payroll period and unpaid leave', () => {
    it('selects the latest effective revision within the payroll period', async () => {
        const { db, service } = fixture(false);
        await service.generate({ roleCode: 'FOUNDER' }, { month: '2026-09' });
        expect(db.employee.findMany.mock.calls[0][0].include.salaryRevisions).toEqual({
            where: { effectiveFrom: { lte: new Date('2026-09-30T23:59:59.999Z') } },
            orderBy: [{ effectiveFrom: 'desc' }, { revisionNumber: 'desc' }], take: 1,
        });
    });
    it('deducts half a day for unpaid half-day leave', async () => {
        const { db, service } = fixture(true, 0.5);
        await service.generate({ roleCode: 'FOUNDER' }, { month: '2026-09' });
        expect(db.payrollLineItem.create.mock.calls[0][0].data).toMatchObject({ absentDays: 0.5, presentDays: 0.5, attendanceAdjustment: 500, netPay: 29500 });
    });
    it.each([true, false])('calculates the deduction with unpaid leave = %s', async isUnpaid => {
        const { db, service } = fixture(isUnpaid);
        await service.generate({ roleCode: 'FOUNDER' }, { month: '2026-09' });
        expect(db.payrollLineItem.create.mock.calls[0][0].data).toMatchObject({
            absentDays: isUnpaid ? 1 : 0, presentDays: isUnpaid ? 0 : 1,
            attendanceAdjustment: isUnpaid ? 1000 : 0, netPay: isUnpaid ? 29000 : 30000,
        });
    });
});
