"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmsDashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let HrmsDashboardService = class HrmsDashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardData() {
        const todayStr = new Date().toISOString().slice(0, 10);
        const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0, 0));
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [totalEmployees, employees, todayAttendance, pendingLeaveCount, pendingAttendanceCount, payrollRun, pendingLeaves, pendingAttendance,] = await Promise.all([
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
        const deptCounts = {};
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
};
exports.HrmsDashboardService = HrmsDashboardService;
exports.HrmsDashboardService = HrmsDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HrmsDashboardService);
//# sourceMappingURL=hrms-dashboard.service.js.map