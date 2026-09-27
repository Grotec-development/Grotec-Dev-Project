import { describe, it, expect, vi } from 'vitest';
import { LeaveService } from './leave.service';

const actor = { id: 'agent', roleCode: 'AGENT' };
const founder = { id: 'founder', roleCode: 'FOUNDER' };
function fixture() {
    const application = { id: 'a', employeeId: 'agent', leaveTypeId: 'type', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-02'), daysCount: 2, status: 'PENDING', leaveType: { isPaid: true }, employee: { fullName: 'Agent', role: { code: 'AGENT' } } };
    const db = {
        employee: {
            findUnique: vi.fn(async () => ({ id: 'agent', fullName: 'Agent', reportingManagerId: null, role: { code: 'AGENT' } })),
            findFirst: vi.fn(async () => null),
            findMany: vi.fn(async () => [
                { id: 'mgr', role: { code: 'MANAGER' } },
                { id: 'founder', role: { code: 'FOUNDER' } },
                { id: 'peer', role: { code: 'AGENT' } },
            ]),
        },
        leaveType: { findUnique: vi.fn(async () => ({ isPaid: true })) },
        leaveBalance: { findUnique: vi.fn(async () => ({ balance: 10 })), updateMany: vi.fn(async () => ({ count: 1 })) },
        leaveApplication: { findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => application), updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async ({ data }) => ({ id: 'a', ...data })) },
        attendanceRecord: { upsert: vi.fn() }, leaveApprovalHistory: { create: vi.fn() }, appNotification: { create: vi.fn(), createMany: vi.fn() },
    };
    db.$transaction = fn => fn(db);
    return { db, application, service: new LeaveService(db, { record: vi.fn() }) };
}
const dto = { leaveTypeId: 'type', startDate: '2026-09-01', endDate: '2026-09-02', daysCount: 2, reason: 'Holiday' };
describe('leave integrity', () => {
    it.each([-2, 0, 1, 0.5, 30])('rejects duration %s inconsistent with dates', async daysCount => {
        const { service, db } = fixture();
        await expect(service.apply(actor, { ...dto, daysCount })).rejects.toMatchObject({ code: 'INVALID_LEAVE_DURATION' });
        expect(db.leaveApplication.create).not.toHaveBeenCalled();
    });
    it('notifies everyone who outranks the applicant when no reporting manager is set', async () => {
        const { service, db } = fixture();
        await service.apply(actor, dto);
        const recipients = db.appNotification.createMany.mock.calls[0][0].data.map((n) => n.recipientId);
        expect(recipients).toEqual(['mgr', 'founder']);
    });
    it('notifies only the active reporting manager when one is set', async () => {
        const { service, db } = fixture();
        db.employee.findUnique.mockResolvedValue({ id: 'agent', fullName: 'Agent', reportingManagerId: 'rm', role: { code: 'AGENT' } });
        db.employee.findFirst.mockResolvedValue({ id: 'rm' });
        await service.apply(actor, dto);
        expect(db.appNotification.createMany.mock.calls[0][0].data.map((n) => n.recipientId)).toEqual(['rm']);
    });
    it('rejects invalid calendar dates', async () => {
        await expect(fixture().service.apply(actor, { ...dto, startDate: '2026-02-30' })).rejects.toMatchObject({ code: 'INVALID_DATE' });
    });
    it('preserves single-date half-day leave', async () => {
        const { service, db } = fixture();
        await service.apply(actor, { ...dto, endDate: dto.startDate, daysCount: 0.5 });
        expect(db.leaveApplication.create.mock.calls[0][0].data.daysCount).toBe(0.5);
    });
    it('deducts only half a day for approved half-day leave', async () => {
        const { service, db, application } = fixture();
        application.endDate = application.startDate; application.daysCount = 0.5;
        await service.approve(founder, 'a');
        expect(db.leaveBalance.updateMany.mock.calls[0][0].data.balance).toEqual({ decrement: 0.5 });
    });
    it('checks balances separately across calendar years', async () => {
        const { service, db } = fixture();
        await service.apply(actor, { ...dto, startDate: '2026-12-31', endDate: '2027-01-01' });
        expect(db.leaveBalance.findUnique.mock.calls.map(([arg]) => arg.where.employeeId_leaveTypeId_year.year)).toEqual([2026, 2027]);
    });
    it('refuses a concurrent decision before deducting any balance', async () => {
        const { service, db } = fixture(); db.leaveApplication.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.approve(founder, 'a')).rejects.toMatchObject({ code: 'LEAVE_ALREADY_DECIDED' });
        expect(db.leaveBalance.updateMany).not.toHaveBeenCalled();
    });
    it('requires sufficient remaining balance at approval', async () => {
        const { service, db } = fixture(); db.leaveBalance.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.approve(founder, 'a')).rejects.toMatchObject({ code: 'INSUFFICIENT_LEAVE_BALANCE' });
        expect(db.leaveBalance.updateMany.mock.calls[0][0].where.balance).toEqual({ gte: 2 });
        expect(db.attendanceRecord.upsert).not.toHaveBeenCalled();
    });
    it('guards rejection against a concurrent approval', async () => {
        const { service, db } = fixture(); db.leaveApplication.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.reject(founder, 'a', { reason: 'Declined' })).rejects.toMatchObject({ code: 'LEAVE_ALREADY_DECIDED' });
    });
});
