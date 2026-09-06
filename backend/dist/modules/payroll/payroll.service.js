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
exports.PayrollService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
let PayrollService = class PayrollService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async listRuns(actor) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can view company payroll runs');
        }
        return this.prisma.payrollRun.findMany({
            orderBy: { month: 'desc' },
            include: {
                _count: { select: { lineItems: true } },
            },
        });
    }
    async getRun(actor, id) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can view company payroll runs');
        }
        const run = await this.prisma.payrollRun.findFirst({
            where: { OR: [{ id }, { month: id }] },
            include: {
                lineItems: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                employeeCode: true,
                                fullName: true,
                                email: true,
                                department: true,
                                designation: true,
                            },
                        },
                    },
                    orderBy: { employee: { employeeCode: 'asc' } },
                },
            },
        });
        if (!run)
            throw api_error_1.ApiError.notFound('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found');
        return run;
    }
    async createRun(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can create payroll runs');
        }
        const existing = await this.prisma.payrollRun.findUnique({ where: { month: dto.month } });
        if (existing)
            return existing;
        return this.prisma.payrollRun.create({
            data: {
                month: dto.month,
                status: shared_1.PayrollStatus.IDLE,
                notes: dto.notes,
            },
        });
    }
    async generate(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can generate payroll');
        }
        const [yearStr, monthStr] = dto.month.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        if (!year || !month || month < 1 || month > 12) {
            throw api_error_1.ApiError.badRequest('INVALID_MONTH', 'Month must be in YYYY-MM format');
        }
        const workingDays = getDaysInMonth(year, month);
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const existingRun = await this.prisma.payrollRun.findUnique({
            where: { month: dto.month },
        });
        if (existingRun &&
            (existingRun.status === shared_1.PayrollStatus.APPROVED_LOCKED ||
                existingRun.status === shared_1.PayrollStatus.PUBLISHED)) {
            throw api_error_1.ApiError.conflict('PAYROLL_RUN_LOCKED', `Payroll run for ${dto.month} is ${existingRun.status} and cannot be recalculated`);
        }
        const employees = await this.prisma.employee.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            include: {
                salaryRevisions: {
                    orderBy: { revisionNumber: 'desc' },
                    take: 1,
                },
                attendanceRecords: {
                    where: {
                        date: { gte: monthStart, lte: monthEnd },
                        approvalStatus: shared_1.ApprovalStatus.APPROVED,
                    },
                },
                advances: {
                    where: { status: 'ACTIVE', runningBalance: { gt: 0 } },
                },
            },
        });
        const run = await this.prisma.$transaction(async (tx) => {
            const payrollRun = await tx.payrollRun.upsert({
                where: { month: dto.month },
                create: {
                    month: dto.month,
                    status: shared_1.PayrollStatus.GENERATED,
                    generatedById: actor.id,
                    generatedAt: new Date(),
                    notes: dto.notes,
                },
                update: {
                    status: shared_1.PayrollStatus.GENERATED,
                    generatedById: actor.id,
                    generatedAt: new Date(),
                    notes: dto.notes,
                },
            });
            await tx.payrollLineItem.deleteMany({
                where: { payrollRunId: payrollRun.id },
            });
            let totalGross = 0;
            let totalDeductions = 0;
            let totalNet = 0;
            for (const emp of employees) {
                const salaryRev = emp.salaryRevisions[0];
                const flags = [];
                let baseSalary = 0;
                if (!salaryRev) {
                    flags.push('NO_SALARY_REVISION');
                }
                else {
                    baseSalary = Number(salaryRev.baseSalary);
                }
                flags.push('WORKING_DAY_BASIS_UNCONFIRMED');
                const comps = salaryRev?.components || {
                    basic: Math.round(baseSalary * 0.5),
                    hra: Math.round(baseSalary * 0.3),
                    allowances: Math.round(baseSalary * 0.2),
                    pf: Math.round(baseSalary * 0.12),
                    esi: 0,
                    tds: 0,
                };
                const grossEarnings = (comps.basic || 0) + (comps.hra || 0) + (comps.allowances || 0);
                const attRecords = emp.attendanceRecords;
                let presentDays = 0;
                let absentDays = 0;
                let halfDays = 0;
                for (const r of attRecords) {
                    if (r.status === 'PRESENT' ||
                        r.status === 'WEEKLY_OFF' ||
                        r.status === 'HOLIDAY' ||
                        r.status === 'LEAVE') {
                        presentDays += 1;
                    }
                    else if (r.status === 'ABSENT') {
                        absentDays += 1;
                    }
                    else if (r.status === 'HALF_DAY') {
                        halfDays += 1;
                        presentDays += 0.5;
                    }
                }
                const perDayRate = workingDays > 0 ? grossEarnings / workingDays : 0;
                const attendanceAdjustment = Math.round(perDayRate * (absentDays + halfDays * 0.5));
                let advanceRecovery = 0;
                const totalAdvanceBalance = emp.advances.reduce((sum, a) => sum + Number(a.runningBalance), 0);
                if (totalAdvanceBalance > 0 && baseSalary > 0) {
                    const maxCap = Math.round(baseSalary * 0.2);
                    advanceRecovery = Math.min(totalAdvanceBalance, maxCap);
                }
                const statutoryDeductions = (comps.pf || 0) + (comps.esi || 0) + (comps.tds || 0) + (comps.otherDeductions || 0);
                const lineTotalDeductions = statutoryDeductions + attendanceAdjustment + advanceRecovery;
                let netPay = grossEarnings - lineTotalDeductions;
                if (netPay < 0) {
                    netPay = 0;
                    flags.push('NEGATIVE_NET_PAY');
                }
                totalGross += grossEarnings;
                totalDeductions += lineTotalDeductions;
                totalNet += netPay;
                await tx.payrollLineItem.create({
                    data: {
                        payrollRunId: payrollRun.id,
                        employeeId: emp.id,
                        effectiveSalaryRevisionId: salaryRev?.id,
                        grossEarnings,
                        totalDeductions: lineTotalDeductions,
                        workingDays,
                        presentDays,
                        absentDays,
                        halfDays,
                        attendanceAdjustment,
                        advanceRecovery,
                        netPay,
                        components: {
                            ...comps,
                            attendanceAdjustment,
                            advanceRecovery,
                        },
                        flags,
                    },
                });
            }
            const finalizedRun = await tx.payrollRun.update({
                where: { id: payrollRun.id },
                data: {
                    totalEmployees: employees.length,
                    totalGross,
                    totalDeductions,
                    totalNet,
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: finalizedRun.id,
                entityLabel: `Payroll Run ${dto.month}`,
                action: shared_1.AuditAction.PAYROLL_GENERATED,
                after: finalizedRun,
            });
            return finalizedRun;
        });
        return run;
    }
    async approve(actor, id, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can approve payroll');
        }
        const run = await this.prisma.payrollRun.findFirst({
            where: { OR: [{ id }, { month: id }] },
            include: { lineItems: true },
        });
        if (!run)
            throw api_error_1.ApiError.notFound('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found');
        if (run.status === shared_1.PayrollStatus.APPROVED_LOCKED || run.status === shared_1.PayrollStatus.PUBLISHED) {
            throw api_error_1.ApiError.conflict('PAYROLL_RUN_LOCKED', `Payroll run is ${run.status} and cannot be modified`);
        }
        if (run.status !== shared_1.PayrollStatus.GENERATED) {
            throw api_error_1.ApiError.badRequest('INVALID_STATUS', `Cannot approve payroll run in status ${run.status}`);
        }
        const hasCriticalFlags = run.lineItems.some((item) => {
            const flags = item.flags || [];
            return flags.includes('NEGATIVE_NET_PAY') || flags.includes('NO_SALARY_REVISION');
        });
        if (hasCriticalFlags && dto?.acknowledgeFlags !== true) {
            throw api_error_1.ApiError.badRequest('UNACKNOWLEDGED_FLAGS', 'Calculation flags (NEGATIVE_NET_PAY or NO_SALARY_REVISION) must be acknowledged before approval');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const res = await tx.payrollRun.update({
                where: { id: run.id },
                data: {
                    status: shared_1.PayrollStatus.APPROVED_LOCKED,
                    approverId: actor.id,
                    approvedAt: new Date(),
                },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: run.id,
                entityLabel: `Payroll Run ${run.month} Approved`,
                action: shared_1.AuditAction.PAYROLL_APPROVED,
                before: run,
                after: res,
            });
            return res;
        });
        return updated;
    }
    async publish(actor, id) {
        if (actor.roleCode !== 'FOUNDER') {
            throw api_error_1.ApiError.forbidden('FOUNDER_ONLY', 'Only the Founder can publish payroll (PRD §5.1.2)');
        }
        const run = await this.prisma.payrollRun.findFirst({
            where: { OR: [{ id }, { month: id }] },
            include: { lineItems: true },
        });
        if (!run)
            throw api_error_1.ApiError.notFound('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found');
        if (run.status === shared_1.PayrollStatus.PUBLISHED) {
            return run;
        }
        if (run.status !== shared_1.PayrollStatus.APPROVED_LOCKED) {
            throw api_error_1.ApiError.badRequest('NOT_APPROVED', 'Payroll run must be approved before publishing');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const res = await tx.payrollRun.update({
                where: { id: run.id },
                data: {
                    status: shared_1.PayrollStatus.PUBLISHED,
                    publishedById: actor.id,
                    publishedAt: new Date(),
                },
            });
            for (const item of run.lineItems) {
                if (Number(item.advanceRecovery) > 0) {
                    const advances = await tx.advanceLedger.findMany({
                        where: { employeeId: item.employeeId, status: 'ACTIVE', runningBalance: { gt: 0 } },
                        orderBy: { issuedAt: 'asc' },
                    });
                    let remainingRecovery = Number(item.advanceRecovery);
                    for (const adv of advances) {
                        if (remainingRecovery <= 0)
                            break;
                        const deduction = Math.min(Number(adv.runningBalance), remainingRecovery);
                        const newBal = Number(adv.runningBalance) - deduction;
                        await tx.advanceRecovery.create({
                            data: {
                                advanceId: adv.id,
                                payrollRunId: run.id,
                                amount: deduction,
                                linkedPayrollMonth: run.month,
                                notes: `Recovered via payroll ${run.month}`,
                            },
                        });
                        await tx.advanceLedger.update({
                            where: { id: adv.id },
                            data: {
                                runningBalance: newBal,
                                status: newBal <= 0 ? 'COMPLETED' : 'ACTIVE',
                            },
                        });
                        remainingRecovery -= deduction;
                    }
                }
                await tx.appNotification.create({
                    data: {
                        recipientId: item.employeeId,
                        type: shared_1.NotificationType.PAYROLL_STATUS,
                        title: `Payslip Available for ${run.month}`,
                        message: `Your payslip for ${run.month} of INR ${Number(item.netPay).toLocaleString('en-IN')} has been published.`,
                        data: { payrollRunId: run.id, lineItemId: item.id, month: run.month },
                    },
                });
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: run.id,
                entityLabel: `Payroll Run ${run.month} Published`,
                action: shared_1.AuditAction.PAYROLL_PUBLISHED,
                before: run,
                after: res,
            });
            return res;
        });
        return updated;
    }
    async getPayslips(actor, employeeId) {
        const conditions = [
            { payrollRun: { status: shared_1.PayrollStatus.PUBLISHED } },
        ];
        if (actor.roleCode === 'FOUNDER') {
            if (employeeId)
                conditions.push({ employeeId });
        }
        else if (actor.roleCode === 'MANAGER') {
            if (employeeId) {
                if (employeeId !== actor.id) {
                    const target = await this.prisma.employee.findUnique({
                        where: { id: employeeId },
                        include: { role: true },
                    });
                    if (!target || !(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view payslips for roles strictly below your rank (PRD §5.1.2)');
                    }
                }
                conditions.push({ employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { role: { code: { in: ['AGENT', 'STAFF', 'DELIVERY'] } } } },
                    ],
                });
            }
        }
        else {
            if (employeeId && employeeId !== actor.id) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own payslips (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        return this.prisma.payrollLineItem.findMany({
            where: { AND: conditions },
            include: {
                payrollRun: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        fullName: true,
                        email: true,
                        department: true,
                        designation: true,
                    },
                },
            },
            orderBy: { payrollRun: { month: 'desc' } },
        });
    }
    async getPayslipDetail(actor, id) {
        const item = await this.prisma.payrollLineItem.findUnique({
            where: { id },
            include: {
                payrollRun: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        fullName: true,
                        email: true,
                        department: true,
                        designation: true,
                        role: true,
                    },
                },
            },
        });
        if (!item)
            throw api_error_1.ApiError.notFound('PAYSLIP_NOT_FOUND', 'Payslip not found');
        if (item.payrollRun.status !== shared_1.PayrollStatus.PUBLISHED) {
            throw api_error_1.ApiError.forbidden('PAYSLIP_NOT_PUBLISHED', 'Payslip is not published yet');
        }
        const isSelf = actor.id === item.employeeId;
        if (!isSelf && actor.roleCode !== 'FOUNDER') {
            if (actor.roleCode !== 'MANAGER' || !(0, shared_1.outranks)(actor.roleCode, item.employee.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Access to payslip is forbidden');
            }
        }
        return item;
    }
    async getPayslipPdf(actor, id) {
        const item = await this.getPayslipDetail(actor, id);
        const comps = item.components;
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip ${item.payrollRun.month} - ${item.employee.fullName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; }
    .title { font-size: 24px; font-weight: bold; color: #065f46; margin: 0; }
    .subtitle { color: #64748b; margin-top: 5px; }
    .grid { display: flex; justify-content: space-between; margin: 25px 0; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    .table th { background: #f8fafc; font-weight: 600; }
    .net-pay { margin-top: 30px; text-align: right; font-size: 20px; font-weight: bold; color: #059669; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">GROTEC AGRI INPUTS</div>
    <div class="subtitle">Payslip for Month: ${item.payrollRun.month}</div>
  </div>
  <div class="grid">
    <div>
      <div><strong>Employee Name:</strong> ${item.employee.fullName}</div>
      <div><strong>Employee Code:</strong> ${item.employee.employeeCode ?? 'N/A'}</div>
      <div><strong>Department:</strong> ${item.employee.department ?? 'N/A'}</div>
    </div>
    <div>
      <div><strong>Working Days:</strong> ${item.workingDays}</div>
      <div><strong>Present Days:</strong> ${item.presentDays}</div>
      <div><strong>Absent Days:</strong> ${item.absentDays}</div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Earnings</th>
        <th>Amount (INR)</th>
        <th>Deductions</th>
        <th>Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Basic Pay</td>
        <td>${Number(comps.basic ?? 0).toFixed(2)}</td>
        <td>PF Deduction</td>
        <td>${Number(comps.pf ?? 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td>HRA</td>
        <td>${Number(comps.hra ?? 0).toFixed(2)}</td>
        <td>Attendance Adjustment</td>
        <td>${Number(item.attendanceAdjustment).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Allowances</td>
        <td>${Number(comps.allowances ?? 0).toFixed(2)}</td>
        <td>Advance Recovery</td>
        <td>${Number(item.advanceRecovery).toFixed(2)}</td>
      </tr>
      <tr style="font-weight: bold; background: #f1f5f9;">
        <td>Total Gross Earnings</td>
        <td>${Number(item.grossEarnings).toFixed(2)}</td>
        <td>Total Deductions</td>
        <td>${Number(item.totalDeductions).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="net-pay">
    Net Take-Home Pay: INR ${Number(item.netPay).toFixed(2)}
  </div>
</body>
</html>`;
        return html;
    }
    async getReports(actor, month, format) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can view payroll cost reports');
        }
        const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const run = await this.prisma.payrollRun.findUnique({
            where: { month: targetMonth },
            include: {
                lineItems: {
                    include: {
                        employee: { select: { department: true } },
                    },
                },
            },
        });
        if (!run) {
            return { month: targetMonth, summary: null, departmentBreakdown: [] };
        }
        const deptMap = {};
        for (const item of run.lineItems) {
            const dept = item.employee.department || 'Unassigned';
            if (!deptMap[dept])
                deptMap[dept] = { count: 0, gross: 0, deductions: 0, net: 0 };
            deptMap[dept].count += 1;
            deptMap[dept].gross += Number(item.grossEarnings);
            deptMap[dept].deductions += Number(item.totalDeductions);
            deptMap[dept].net += Number(item.netPay);
        }
        const departmentBreakdown = Object.entries(deptMap).map(([department, data]) => ({
            department,
            employeeCount: data.count,
            gross: data.gross,
            deductions: data.deductions,
            net: data.net,
        }));
        if (format === 'csv') {
            const header = 'Department,EmployeeCount,GrossEarnings,TotalDeductions,NetPay\n';
            const rows = departmentBreakdown.map((d) => `"${d.department}",${d.employeeCount},${d.gross.toFixed(2)},${d.deductions.toFixed(2)},${d.net.toFixed(2)}`);
            return header + rows.join('\n');
        }
        return {
            month: targetMonth,
            runId: run.id,
            status: run.status,
            summary: {
                totalEmployees: run.totalEmployees,
                totalGross: Number(run.totalGross),
                totalDeductions: Number(run.totalDeductions),
                totalNet: Number(run.totalNet),
            },
            departmentBreakdown,
        };
    }
    async getSalaryRevisions(actor, employeeId) {
        const emp = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { role: true },
        });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        const isSelf = actor.id === employeeId;
        if (!isSelf && actor.roleCode !== 'FOUNDER') {
            if (actor.roleCode !== 'MANAGER' || !(0, shared_1.outranks)(actor.roleCode, emp.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Access to salary revisions is forbidden');
            }
        }
        return this.prisma.salaryRevision.findMany({
            where: { employeeId },
            include: { componentsList: true },
            orderBy: { revisionNumber: 'desc' },
        });
    }
    async createSalaryRevision(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can create salary revisions');
        }
        const emp = await this.prisma.employee.findUnique({
            where: { id: dto.employeeId },
            include: { role: true },
        });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (actor.roleCode !== 'FOUNDER' && !(0, shared_1.outranks)(actor.roleCode, emp.role.code)) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Cannot create revision for this role');
        }
        const latest = await this.prisma.salaryRevision.findFirst({
            where: { employeeId: dto.employeeId },
            orderBy: { revisionNumber: 'desc' },
        });
        const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
        const comps = dto.components;
        const grossSalary = (comps.basic || 0) + (comps.hra || 0) + (comps.allowances || 0);
        const totalDeductions = (comps.pf || 0) + (comps.esi || 0) + (comps.tds || 0) + (comps.otherDeductions || 0);
        const netSalary = grossSalary - totalDeductions;
        return this.prisma.$transaction(async (tx) => {
            const revision = await tx.salaryRevision.create({
                data: {
                    employeeId: dto.employeeId,
                    effectiveFrom: new Date(dto.effectiveFrom),
                    revisionNumber,
                    baseSalary: dto.baseSalary,
                    components: dto.components,
                    grossSalary,
                    totalDeductions,
                    netSalary,
                    savedById: actor.id,
                    notes: dto.notes,
                },
            });
            for (const [name, amt] of Object.entries(dto.components)) {
                if (typeof amt === 'number') {
                    const isDeduction = ['pf', 'esi', 'tds', 'otherDeductions'].includes(name);
                    await tx.salaryComponent.create({
                        data: {
                            salaryRevisionId: revision.id,
                            name,
                            type: isDeduction ? 'DEDUCTION' : 'EARNING',
                            amount: amt,
                        },
                    });
                }
            }
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: shared_1.AuditEntityType.EMPLOYEE,
                entityId: dto.employeeId,
                entityLabel: `Salary Revision #${revisionNumber} for ${emp.fullName}`,
                action: shared_1.AuditAction.UPDATED,
                after: revision,
            });
            return revision;
        });
    }
    async listAdvances(actor, filters) {
        const conditions = [];
        if (actor.roleCode === 'FOUNDER') {
            if (filters.employeeId)
                conditions.push({ employeeId: filters.employeeId });
        }
        else if (actor.roleCode === 'MANAGER') {
            if (filters.employeeId) {
                if (filters.employeeId !== actor.id) {
                    const target = await this.prisma.employee.findUnique({
                        where: { id: filters.employeeId },
                        include: { role: true },
                    });
                    if (!target || !(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Access to advances is forbidden');
                    }
                }
                conditions.push({ employeeId: filters.employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { role: { code: { in: ['AGENT', 'STAFF', 'DELIVERY'] } } } },
                    ],
                });
            }
        }
        else {
            if (filters.employeeId && filters.employeeId !== actor.id) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own advances');
            }
            conditions.push({ employeeId: actor.id });
        }
        if (filters.status)
            conditions.push({ status: filters.status });
        return this.prisma.advanceLedger.findMany({
            where: { AND: conditions },
            include: {
                recoveries: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        fullName: true,
                        email: true,
                        department: true,
                    },
                },
            },
            orderBy: { issuedAt: 'desc' },
        });
    }
    async createAdvance(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can issue salary advances');
        }
        const emp = await this.prisma.employee.findUnique({
            where: { id: dto.employeeId },
            include: { role: true },
        });
        if (!emp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (actor.roleCode !== 'FOUNDER' && !(0, shared_1.outranks)(actor.roleCode, emp.role.code)) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'Cannot issue advance to this role');
        }
        return this.prisma.advanceLedger.create({
            data: {
                employeeId: dto.employeeId,
                amount: dto.amount,
                runningBalance: dto.amount,
                reason: dto.reason,
                linkedMonth: dto.linkedMonth,
                status: 'ACTIVE',
            },
            include: {
                employee: { select: { id: true, fullName: true, employeeCode: true } },
            },
        });
    }
};
exports.PayrollService = PayrollService;
exports.PayrollService = PayrollService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PayrollService);
//# sourceMappingURL=payroll.service.js.map