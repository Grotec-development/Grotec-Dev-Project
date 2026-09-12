"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROPOSED_ROLE_PERMISSIONS = exports.PERMISSION_CODES = exports.PERMISSIONS = void 0;
/**
 * Fine-grained permission codes enforced at the API/backend layer.
 * The role→permission matrix below is PROVISIONAL until the PRD v2.1 permission
 * matrix is reviewed (docs/permissions.md, docs/open-items.md). It is seed data,
 * so corrections are data-only.
 */
exports.PERMISSIONS = {
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
    // Customer referrals (Step 3B): read = view referrals, manage = create them
    referralRead: 'referral.read',
    referralManage: 'referral.manage',
    // Customer bulk import (Step 4)
    customerImport: 'customer.import',
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
};
/** @typedef {typeof PERMISSIONS[keyof typeof PERMISSIONS]} PermissionCode */
/** @type {PermissionCode[]} */
exports.PERMISSION_CODES = Object.values(exports.PERMISSIONS);
/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - HRMS Employee/Attendance/Leave/Payroll:
 *   - Founder: Full access across CRM + HRMS + Payroll approvals + Audit
 *   - Manager/Admin: Operational CRM + HRMS + Attendance/Leave/Payroll approvals + KPI config
 *   - Agent: CRM workload + Knowledge Base (zero hrms* permissions per §5.1.3)
 *   - Staff: HRMS employee management, attendance & leave processing, payroll preparation
 */
exports.PROPOSED_ROLE_PERMISSIONS = {
    FOUNDER: [
        exports.PERMISSIONS.employeeRead,
        exports.PERMISSIONS.employeeCreate,
        exports.PERMISSIONS.employeeUpdate,
        exports.PERMISSIONS.employeeDeactivate,
        exports.PERMISSIONS.employeeResetPassword,
        exports.PERMISSIONS.roleRead,
        exports.PERMISSIONS.permissionRead,
        exports.PERMISSIONS.customerRead,
        exports.PERMISSIONS.customerCreate,
        exports.PERMISSIONS.customerUpdate,
        exports.PERMISSIONS.customerDeactivate,
        exports.PERMISSIONS.cropRead,
        exports.PERMISSIONS.cropManage,
        exports.PERMISSIONS.leadRead,
        exports.PERMISSIONS.leadCreate,
        exports.PERMISSIONS.leadUpdate,
        exports.PERMISSIONS.leadAssign,
        exports.PERMISSIONS.callRead,
        exports.PERMISSIONS.callManage,
        exports.PERMISSIONS.relationshipRead,
        exports.PERMISSIONS.relationshipManage,
        exports.PERMISSIONS.assistantUse,
        exports.PERMISSIONS.assistantManage,
        exports.PERMISSIONS.referralRead,
        exports.PERMISSIONS.referralManage,
        exports.PERMISSIONS.customerImport,
        exports.PERMISSIONS.auditRead,
        exports.PERMISSIONS.hrmsRead,
        exports.PERMISSIONS.attendanceRead,
        exports.PERMISSIONS.attendanceApprove,
        exports.PERMISSIONS.hrmsAttendanceManage,
        exports.PERMISSIONS.leaveRead,
        exports.PERMISSIONS.leaveApprove,
        exports.PERMISSIONS.hrmsLeaveManage,
        exports.PERMISSIONS.payrollRead,
        exports.PERMISSIONS.payrollManage,
        exports.PERMISSIONS.payrollApprove,
        exports.PERMISSIONS.kpiRead,
        exports.PERMISSIONS.kpiManage,
        exports.PERMISSIONS.hrmsEmployeeManage,
        exports.PERMISSIONS.hrmsEmployeeRead,
        exports.PERMISSIONS.hrmsPayrollProcess,
        exports.PERMISSIONS.hrmsPayrollApprove,
        exports.PERMISSIONS.hrmsPayrollRead,
        exports.PERMISSIONS.hrmsKpiConfigure,
        exports.PERMISSIONS.hrmsAuditRead,
    ],
    MANAGER: [
        exports.PERMISSIONS.employeeRead,
        exports.PERMISSIONS.employeeCreate,
        exports.PERMISSIONS.employeeUpdate,
        exports.PERMISSIONS.customerRead,
        exports.PERMISSIONS.customerCreate,
        exports.PERMISSIONS.customerUpdate,
        exports.PERMISSIONS.customerDeactivate,
        exports.PERMISSIONS.cropRead,
        exports.PERMISSIONS.cropManage,
        exports.PERMISSIONS.leadRead,
        exports.PERMISSIONS.leadCreate,
        exports.PERMISSIONS.leadUpdate,
        exports.PERMISSIONS.leadAssign,
        exports.PERMISSIONS.callRead,
        exports.PERMISSIONS.callManage,
        exports.PERMISSIONS.relationshipRead,
        exports.PERMISSIONS.relationshipManage,
        exports.PERMISSIONS.assistantUse,
        exports.PERMISSIONS.assistantManage,
        exports.PERMISSIONS.referralRead,
        exports.PERMISSIONS.referralManage,
        exports.PERMISSIONS.customerImport,
        exports.PERMISSIONS.hrmsRead,
        // Self-service
        exports.PERMISSIONS.attendanceRead,
        exports.PERMISSIONS.attendanceMark,
        exports.PERMISSIONS.hrmsAttendanceRead,
        exports.PERMISSIONS.leaveRead,
        exports.PERMISSIONS.leaveApply,
        exports.PERMISSIONS.hrmsLeaveRead,
        exports.PERMISSIONS.hrmsLeaveApply,
        exports.PERMISSIONS.payrollRead,
        exports.PERMISSIONS.kpiRead,
        exports.PERMISSIONS.hrmsKpiRead,
        // Team oversight
        exports.PERMISSIONS.attendanceApprove,
        exports.PERMISSIONS.hrmsAttendanceManage,
        exports.PERMISSIONS.leaveApprove,
        exports.PERMISSIONS.hrmsLeaveManage,
        exports.PERMISSIONS.payrollManage,
        exports.PERMISSIONS.payrollApprove,
        exports.PERMISSIONS.kpiManage,
        exports.PERMISSIONS.hrmsEmployeeManage,
        exports.PERMISSIONS.hrmsEmployeeRead,
        exports.PERMISSIONS.hrmsPayrollProcess,
        exports.PERMISSIONS.hrmsPayrollApprove,
        exports.PERMISSIONS.hrmsPayrollRead,
        exports.PERMISSIONS.hrmsKpiConfigure,
        // NOTE: Manager does NOT receive auditRead or hrmsAuditRead (§5.2)
    ],
    AGENT: [
        exports.PERMISSIONS.customerRead,
        exports.PERMISSIONS.customerCreate,
        exports.PERMISSIONS.customerUpdate,
        exports.PERMISSIONS.cropRead,
        exports.PERMISSIONS.leadRead,
        exports.PERMISSIONS.leadCreate,
        exports.PERMISSIONS.leadUpdate,
        exports.PERMISSIONS.callRead,
        exports.PERMISSIONS.callManage,
        // Read-only view of the relationship-manager portfolio. Agents do NOT get
        // relationshipManage: assignment and release stay with Founder/Manager.
        exports.PERMISSIONS.relationshipRead,
        exports.PERMISSIONS.assistantUse,
        exports.PERMISSIONS.referralRead,
        exports.PERMISSIONS.referralManage,
        exports.PERMISSIONS.hrmsRead,
        // Self-service only
        exports.PERMISSIONS.attendanceRead,
        exports.PERMISSIONS.attendanceMark,
        exports.PERMISSIONS.hrmsAttendanceRead,
        exports.PERMISSIONS.leaveRead,
        exports.PERMISSIONS.leaveApply,
        exports.PERMISSIONS.hrmsLeaveRead,
        exports.PERMISSIONS.hrmsLeaveApply,
        exports.PERMISSIONS.payrollRead,
        exports.PERMISSIONS.kpiRead,
        exports.PERMISSIONS.hrmsKpiRead,
    ],
    STAFF: [
        exports.PERMISSIONS.hrmsEmployeeRead,
        exports.PERMISSIONS.hrmsPayrollProcess,
        exports.PERMISSIONS.payrollRead,
        exports.PERMISSIONS.hrmsRead,
        // Self-service only
        exports.PERMISSIONS.attendanceRead,
        exports.PERMISSIONS.attendanceMark,
        exports.PERMISSIONS.hrmsAttendanceRead,
        exports.PERMISSIONS.leaveRead,
        exports.PERMISSIONS.leaveApply,
        exports.PERMISSIONS.hrmsLeaveRead,
        exports.PERMISSIONS.hrmsLeaveApply,
        exports.PERMISSIONS.kpiRead,
        exports.PERMISSIONS.hrmsKpiRead,
    ],
    DELIVERY: [
        exports.PERMISSIONS.hrmsRead,
        // Self-service only
        exports.PERMISSIONS.attendanceRead,
        exports.PERMISSIONS.attendanceMark,
        exports.PERMISSIONS.hrmsAttendanceRead,
        exports.PERMISSIONS.leaveRead,
        exports.PERMISSIONS.leaveApply,
        exports.PERMISSIONS.hrmsLeaveRead,
        exports.PERMISSIONS.hrmsLeaveApply,
        exports.PERMISSIONS.payrollRead,
        exports.PERMISSIONS.kpiRead,
        exports.PERMISSIONS.hrmsKpiRead,
    ],
};
