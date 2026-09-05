import type { RoleCode } from './roles';

/**
 * Fine-grained permission codes enforced at the API/backend layer.
 * The role→permission matrix below is PROVISIONAL until the PRD v2.1 permission
 * matrix is reviewed (docs/permissions.md, docs/open-items.md). It is seed data,
 * so corrections are data-only.
 */
export const PERMISSIONS = {
  // Identity / employees
  employeeRead: 'employee.read',
  employeeCreate: 'employee.create',
  employeeUpdate: 'employee.update',
  employeeDeactivate: 'employee.deactivate',
  employeeResetPassword: 'employee.reset_password',
  roleRead: 'role.read',
  permissionRead: 'permission.read',
  // Customers / farmer master
  customerRead: 'customer.read',
  customerCreate: 'customer.create',
  customerUpdate: 'customer.update',
  customerDeactivate: 'customer.deactivate',
  // Crops
  cropRead: 'crop.read',
  cropManage: 'crop.manage',
  // Leads + ownership
  leadRead: 'lead.read',
  leadCreate: 'lead.create',
  leadUpdate: 'lead.update',
  leadAssign: 'lead.assign',
  // Calls / agent workspace (Month 2)
  callRead: 'call.read',
  callManage: 'call.manage',
  // Relationship ownership / RM workspace (Month 4)
  relationshipRead: 'relationship.read',
  relationshipManage: 'relationship.manage',
  // AI Assistant (replaces the Knowledge Base screen): use = chat, manage = content
  assistantUse: 'assistant.use',
  assistantManage: 'assistant.manage',
  // Audit
  auditRead: 'audit.read',
  // HRMS & Attendance
  hrmsRead: 'hrms.read',
  attendanceRead: 'attendance.read',
  attendanceMark: 'attendance.mark',
  attendanceApprove: 'attendance.approve',
  // Leave
  leaveRead: 'leave.read',
  leaveApply: 'leave.apply',
  leaveApprove: 'leave.approve',
  // Payroll & Salary
  payrollRead: 'payroll.read',
  payrollManage: 'payroll.manage',
  payrollApprove: 'payroll.approve',
  // KPI
  kpiRead: 'kpi.read',
  kpiManage: 'kpi.manage',
  // HRMS fine-grained permissions (Part 2)
  hrmsEmployeeManage: 'hrms.employee.manage',
  hrmsEmployeeRead: 'hrms.employee.read',
  hrmsAttendanceManage: 'hrms.attendance.manage',
  hrmsAttendanceRead: 'hrms.attendance.read',
  hrmsLeaveManage: 'hrms.leave.manage',
  hrmsLeaveRead: 'hrms.leave.read',
  hrmsLeaveApply: 'hrms.leave.apply',
  hrmsPayrollProcess: 'hrms.payroll.process',
  hrmsPayrollApprove: 'hrms.payroll.approve',
  hrmsPayrollRead: 'hrms.payroll.read',
  hrmsKpiConfigure: 'hrms.kpi.configure',
  hrmsKpiRead: 'hrms.kpi.read',
  hrmsAuditRead: 'hrms.audit.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const PERMISSION_CODES: PermissionCode[] = Object.values(PERMISSIONS);

/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - HRMS Employee/Attendance/Leave/Payroll:
 *   - Founder: Full access across CRM + HRMS + Payroll approvals + Audit
 *   - Manager/Admin: Operational CRM + HRMS + Attendance/Leave/Payroll approvals + KPI config
 *   - Agent: CRM workload + Knowledge Base (zero hrms* permissions per §5.1.3)
 *   - Staff: HRMS employee management, attendance & leave processing, payroll preparation
 */
export const PROPOSED_ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  FOUNDER: PERMISSION_CODES,
  MANAGER: [
    PERMISSIONS.employeeRead,
    PERMISSIONS.employeeCreate,
    PERMISSIONS.employeeUpdate,
    PERMISSIONS.customerRead,
    PERMISSIONS.customerCreate,
    PERMISSIONS.customerUpdate,
    PERMISSIONS.customerDeactivate,
    PERMISSIONS.cropRead,
    PERMISSIONS.cropManage,
    PERMISSIONS.leadRead,
    PERMISSIONS.leadCreate,
    PERMISSIONS.leadUpdate,
    PERMISSIONS.leadAssign,
    PERMISSIONS.callRead,
    PERMISSIONS.callManage,
    PERMISSIONS.relationshipRead,
    PERMISSIONS.relationshipManage,
    PERMISSIONS.assistantUse,
    PERMISSIONS.assistantManage,
    PERMISSIONS.hrmsRead,
    PERMISSIONS.attendanceRead,
    PERMISSIONS.attendanceMark,
    PERMISSIONS.attendanceApprove,
    PERMISSIONS.leaveRead,
    PERMISSIONS.leaveApply,
    PERMISSIONS.leaveApprove,
    PERMISSIONS.payrollRead,
    PERMISSIONS.payrollManage,
    PERMISSIONS.payrollApprove,
    PERMISSIONS.kpiRead,
    PERMISSIONS.kpiManage,
    // HRMS Part 2 permissions
    PERMISSIONS.hrmsEmployeeManage,
    PERMISSIONS.hrmsEmployeeRead,
    PERMISSIONS.hrmsAttendanceManage,
    PERMISSIONS.hrmsAttendanceRead,
    PERMISSIONS.hrmsLeaveManage,
    PERMISSIONS.hrmsLeaveRead,
    PERMISSIONS.hrmsLeaveApply,
    PERMISSIONS.hrmsPayrollProcess,
    PERMISSIONS.hrmsPayrollApprove,
    PERMISSIONS.hrmsPayrollRead,
    PERMISSIONS.hrmsKpiConfigure,
    PERMISSIONS.hrmsKpiRead,
    // NOTE: Manager does NOT receive auditRead or hrmsAuditRead (§5.2)
  ],
  AGENT: [
    PERMISSIONS.customerRead,
    PERMISSIONS.customerCreate,
    PERMISSIONS.customerUpdate,
    PERMISSIONS.cropRead,
    PERMISSIONS.leadRead,
    PERMISSIONS.leadCreate,
    PERMISSIONS.leadUpdate,
    PERMISSIONS.callRead,
    PERMISSIONS.callManage,
    PERMISSIONS.assistantUse,
    PERMISSIONS.hrmsRead,
    PERMISSIONS.attendanceRead,
    PERMISSIONS.attendanceMark,
    PERMISSIONS.leaveRead,
    PERMISSIONS.leaveApply,
    PERMISSIONS.payrollRead,
    PERMISSIONS.kpiRead,
  ],
  STAFF: [
    PERMISSIONS.hrmsEmployeeRead,
    PERMISSIONS.hrmsAttendanceManage,
    PERMISSIONS.hrmsAttendanceRead,
    PERMISSIONS.hrmsLeaveApply,
    PERMISSIONS.hrmsPayrollProcess,
    // Compat aliases
    PERMISSIONS.hrmsRead,
    PERMISSIONS.attendanceRead,
    PERMISSIONS.attendanceMark,
    PERMISSIONS.leaveRead,
    PERMISSIONS.leaveApply,
    PERMISSIONS.payrollRead,
    PERMISSIONS.kpiRead,
  ],
  DELIVERY: [
    PERMISSIONS.attendanceRead,
    PERMISSIONS.attendanceMark,
    PERMISSIONS.leaveRead,
    PERMISSIONS.leaveApply,
    PERMISSIONS.payrollRead,
    PERMISSIONS.kpiRead,
    PERMISSIONS.hrmsAttendanceRead,
    PERMISSIONS.hrmsAttendanceManage,
    PERMISSIONS.hrmsLeaveApply,
    PERMISSIONS.hrmsLeaveRead,
    PERMISSIONS.hrmsPayrollRead,
    PERMISSIONS.hrmsKpiRead,
  ],
};
