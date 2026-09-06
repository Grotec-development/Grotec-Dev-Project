import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HrmsDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0, 0, 0, 0,
    ));

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const [
      totalEmployees,
      employees,
      todayAttendance,
      pendingLeaveCount,
      pendingAttendanceCount,
      payrollRun,
      pendingLeaves,
      pendingAttendance,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.employee.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { department: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { date: today },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: true,
            },
          },
        },
      }),
      this.prisma.leaveApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.attendanceRecord.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.payrollRun.findUnique({ where: { month: currentMonth } }),
      this.prisma.leaveApplication.findMany({
        where: { status: 'PENDING' },
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true, department: true },
          },
          leaveType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.attendanceRecord.findMany({
        where: { approvalStatus: 'PENDING' },
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true, department: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const presentToday = todayAttendance.filter((a) => a.status === 'PRESENT').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'LATE').length;
    const halfDayToday = todayAttendance.filter((a) => a.status === 'HALF_DAY').length;
    const leaveToday = todayAttendance.filter((a) => a.status === 'LEAVE').length;
    const absentToday = Math.max(0, totalEmployees - presentToday - lateToday - halfDayToday - leaveToday);

    const deptCounts: Record<string, number> = {};
    for (const e of employees) {
      const d = e.department || 'Unassigned';
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    }

    const pendingPayrollApprovals = payrollRun?.status === 'GENERATED' ? 1 : 0;
    const pendingApprovalsTotal = pendingAttendanceCount + pendingLeaveCount + pendingPayrollApprovals;

    return {
      totalEmployees,
      presentToday: presentToday + lateToday,
      pendingLeaveRequests: pendingLeaveCount,
      pendingPayrollApprovals,
      todaysAttendanceBreakdown: {
        present: presentToday,
        absent: absentToday,
        halfDay: halfDayToday,
        late: lateToday,
        onLeave: leaveToday,
      },
      pendingApprovalsTotal,
      metrics: {
        totalEmployees,
        presentToday: presentToday + lateToday,
        lateToday,
        halfDayToday,
        leaveToday,
        absentToday,
        pendingAttendanceApprovals: pendingAttendanceCount,
        pendingLeaveApprovals: pendingLeaveCount,
        pendingPayrollApprovals,
        currentPayrollMonth: currentMonth,
        currentPayrollStatus: payrollRun?.status || 'IDLE',
      },
      todayAttendance,
      pendingApprovals: {
        leaves: pendingLeaves,
        attendance: pendingAttendance,
      },
      departmentDistribution: deptCounts,
    };
  }
}
