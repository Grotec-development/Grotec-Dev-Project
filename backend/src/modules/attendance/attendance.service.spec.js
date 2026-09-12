import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttendanceService } from './attendance.service';
import { ApprovalStatus, AttendanceSource, AttendanceStatus, PERMISSIONS } from '@grotec/shared';

describe('AttendanceService (Regularization & Shift Permissions)', () => {
  let service;
  let mockPrisma;
  let mockAudit;

  const agentActor = {
    id: 'emp-agent-1',
    roleCode: 'AGENT',
    permissions: [PERMISSIONS.attendanceRead, PERMISSIONS.attendanceMark],
  };

  const founderActor = {
    id: 'emp-founder-1',
    roleCode: 'FOUNDER',
    permissions: Object.values(PERMISSIONS),
  };

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'emp-agent-1',
          fullName: 'Agent Telecaller',
          role: { code: 'AGENT' },
        }),
      },
      attendanceRecord: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      attendanceApprovalHistory: {
        create: vi.fn().mockResolvedValue({ id: 'hist-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(true),
    };

    service = new AttendanceService(mockPrisma, mockAudit);
  });

  it('creates a new PENDING attendance record when no record exists for that date', async () => {
    mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'att-new', ...data })
    );

    const result = await service.mark(agentActor, {
      date: '2026-09-10',
      status: AttendanceStatus.PRESENT,
      notes: '[Permission: Work From Home] Shift duty from home',
    });

    expect(result.id).toBe('att-new');
    expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(result.notes).toBe('[Permission: Work From Home] Shift duty from home');
    expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.attendanceApprovalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attendanceRecordId: 'att-new',
        action: 'CREATED_MANUAL',
        toStatus: ApprovalStatus.PENDING,
      }),
    });
  });

  it('updates existing record and resets to PENDING when attendance record already exists with notes', async () => {
    const existingRecord = {
      id: 'att-existing-1',
      employeeId: 'emp-agent-1',
      date: new Date('2026-09-10T00:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      source: AttendanceSource.ESSL,
      punchIn: new Date('2026-09-10T09:05:00.000Z'),
      punchOut: null,
      notes: null,
      approvalStatus: ApprovalStatus.APPROVED,
      approverId: 'mgr-1',
      approvedAt: new Date('2026-09-10T09:10:00.000Z'),
      rejectionReason: null,
    };

    mockPrisma.attendanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.attendanceRecord.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existingRecord, ...data })
    );

    const result = await service.mark(agentActor, {
      date: '2026-09-10',
      status: AttendanceStatus.HALF_DAY,
      notes: '[Permission: Early Exit] Family emergency at home',
    });

    expect(result.id).toBe('att-existing-1');
    expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(result.notes).toBe('[Permission: Early Exit] Family emergency at home');
    expect(result.punchIn).toEqual(existingRecord.punchIn);
    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(result.source).toBe(AttendanceSource.ESSL);

    expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 'att-existing-1' },
      data: {
        notes: '[Permission: Early Exit] Family emergency at home',
        approvalStatus: ApprovalStatus.PENDING,
        approverId: null,
        approvedAt: null,
        rejectionReason: null,
      },
    });

    expect(mockPrisma.attendanceApprovalHistory.create).toHaveBeenCalledWith({
      data: {
        attendanceRecordId: 'att-existing-1',
        actorId: 'emp-agent-1',
        action: 'REGULARIZATION_REQUESTED',
        fromStatus: ApprovalStatus.APPROVED,
        toStatus: ApprovalStatus.PENDING,
        reason: '[Permission: Early Exit] Family emergency at home',
      },
    });

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'attendance.corrected',
        entityId: 'att-existing-1',
      })
    );
  });

  it('appends to existing notes if the record already has notes', async () => {
    const existingRecord = {
      id: 'att-existing-2',
      employeeId: 'emp-agent-1',
      date: new Date('2026-09-10T00:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      notes: 'Morning biometric gate entry',
      approvalStatus: ApprovalStatus.APPROVED,
    };

    mockPrisma.attendanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.attendanceRecord.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existingRecord, ...data })
    );

    const result = await service.mark(agentActor, {
      date: '2026-09-10',
      status: AttendanceStatus.LATE,
      notes: '[Permission: Late Arrival] Heavy rain traffic delay',
    });

    expect(result.notes).toBe(
      'Morning biometric gate entry | [Permission: Late Arrival] Heavy rain traffic delay'
    );
    expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
  });

  it('throws ATTENDANCE_ALREADY_EXISTS when attendance exists but no notes/reason are provided', async () => {
    const existingRecord = {
      id: 'att-existing-3',
      employeeId: 'emp-agent-1',
      date: new Date('2026-09-10T00:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      notes: null,
    };

    mockPrisma.attendanceRecord.findUnique.mockResolvedValue(existingRecord);

    await expect(
      service.mark(agentActor, {
        date: '2026-09-10',
        status: AttendanceStatus.PRESENT,
      })
    ).rejects.toThrow('Attendance record already exists for this date');
  });

  it('rejects attendance marking for FOUNDER role', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-founder-1',
      fullName: 'Founder CEO',
      role: { code: 'FOUNDER' },
    });

    await expect(
      service.mark(founderActor, {
        date: '2026-09-10',
        status: AttendanceStatus.PRESENT,
        notes: 'Founder shift',
      })
    ).rejects.toThrow('Founder / CEO is the business owner and is not tracked for attendance');
  });

  describe('ESSL Webhook & Sync', () => {
    const originalEnv = process.env.ESSL_WEBHOOK_SECRET;

    it('throws WEBHOOKS_DISABLED if ESSL_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.ESSL_WEBHOOK_SECRET;
      try {
        await expect(
          service.handleEsslWebhook('any-secret', { deviceId: 'dev-1', punches: [] })
        ).rejects.toThrow('ESSL webhook secret is not configured');
      } finally {
        if (originalEnv !== undefined) {
          process.env.ESSL_WEBHOOK_SECRET = originalEnv;
        }
      }
    });

    it('throws INVALID_WEBHOOK_SECRET if secret does not match', async () => {
      process.env.ESSL_WEBHOOK_SECRET = 'configured-secret';
      try {
        await expect(
          service.handleEsslWebhook('wrong-secret', { deviceId: 'dev-1', punches: [] })
        ).rejects.toThrow('Invalid ESSL webhook secret');
      } finally {
        if (originalEnv !== undefined) {
          process.env.ESSL_WEBHOOK_SECRET = originalEnv;
        } else {
          delete process.env.ESSL_WEBHOOK_SECRET;
        }
      }
    });

    it('syncEssl returns synced 0 and does NOT synthesize fake punches when punches is empty', async () => {
      mockPrisma.esslDevice = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'dev-1',
            deviceCode: 'DEV-01',
            name: 'Main Gate',
            mappings: [{ biometricPin: '101', employeeId: 'emp-1' }],
          },
        ]),
      };

      const result = await service.syncEssl(founderActor, { date: '2026-09-10', punches: [] });
      expect(result).toEqual({ synced: 0, date: '2026-09-10' });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('syncEssl forbids AGENT from triggering hardware sync', async () => {
      await expect(
        service.syncEssl(agentActor, { date: '2026-09-10', punches: [] })
      ).rejects.toThrow('Agents cannot trigger biometric hardware sync');
    });
  });
});

