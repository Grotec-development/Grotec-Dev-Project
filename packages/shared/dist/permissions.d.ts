import type { RoleCode } from './roles';
/**
 * Fine-grained permission codes enforced at the API/backend layer.
 * The role→permission matrix below is PROVISIONAL until the PRD v2.1 permission
 * matrix is reviewed (docs/permissions.md, docs/open-items.md). It is seed data,
 * so corrections are data-only.
 */
export declare const PERMISSIONS: {
    readonly employeeRead: "employee.read";
    readonly employeeCreate: "employee.create";
    readonly employeeUpdate: "employee.update";
    readonly employeeDeactivate: "employee.deactivate";
    readonly employeeResetPassword: "employee.reset_password";
    readonly roleRead: "role.read";
    readonly permissionRead: "permission.read";
    readonly customerRead: "customer.read";
    readonly customerCreate: "customer.create";
    readonly customerUpdate: "customer.update";
    readonly customerDeactivate: "customer.deactivate";
    readonly cropRead: "crop.read";
    readonly cropManage: "crop.manage";
    readonly leadRead: "lead.read";
    readonly leadCreate: "lead.create";
    readonly leadUpdate: "lead.update";
    readonly leadAssign: "lead.assign";
    readonly callRead: "call.read";
    readonly callManage: "call.manage";
    readonly relationshipRead: "relationship.read";
    readonly relationshipManage: "relationship.manage";
    readonly assistantUse: "assistant.use";
    readonly assistantManage: "assistant.manage";
    readonly auditRead: "audit.read";
    readonly hrmsRead: "hrms.read";
    readonly attendanceRead: "attendance.read";
    readonly attendanceMark: "attendance.mark";
    readonly attendanceApprove: "attendance.approve";
    readonly leaveRead: "leave.read";
    readonly leaveApply: "leave.apply";
    readonly leaveApprove: "leave.approve";
    readonly payrollRead: "payroll.read";
    readonly payrollManage: "payroll.manage";
    readonly payrollApprove: "payroll.approve";
    readonly kpiRead: "kpi.read";
    readonly kpiManage: "kpi.manage";
    readonly hrmsEmployeeManage: "hrms.employee.manage";
    readonly hrmsEmployeeRead: "hrms.employee.read";
    readonly hrmsAttendanceManage: "hrms.attendance.manage";
    readonly hrmsAttendanceRead: "hrms.attendance.read";
    readonly hrmsLeaveManage: "hrms.leave.manage";
    readonly hrmsLeaveRead: "hrms.leave.read";
    readonly hrmsLeaveApply: "hrms.leave.apply";
    readonly hrmsPayrollProcess: "hrms.payroll.process";
    readonly hrmsPayrollApprove: "hrms.payroll.approve";
    readonly hrmsPayrollRead: "hrms.payroll.read";
    readonly hrmsKpiConfigure: "hrms.kpi.configure";
    readonly hrmsKpiRead: "hrms.kpi.read";
    readonly hrmsAuditRead: "hrms.audit.read";
};
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const PERMISSION_CODES: PermissionCode[];
/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - HRMS Employee/Attendance/Leave/Payroll:
 *   - Founder: Full access across CRM + HRMS + Payroll approvals + Audit
 *   - Manager/Admin: Operational CRM + HRMS + Attendance/Leave/Payroll approvals + KPI config
 *   - Agent: CRM workload + Knowledge Base (zero hrms* permissions per §5.1.3)
 *   - Staff: HRMS employee management, attendance & leave processing, payroll preparation
 */
export declare const PROPOSED_ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]>;
