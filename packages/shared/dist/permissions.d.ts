export namespace PERMISSIONS {
    let employeeRead: string;
    let employeeCreate: string;
    let employeeUpdate: string;
    let employeeDeactivate: string;
    let employeeResetPassword: string;
    let roleRead: string;
    let permissionRead: string;
    let customerRead: string;
    let customerCreate: string;
    let customerUpdate: string;
    let customerDeactivate: string;
    let cropRead: string;
    let cropManage: string;
    let leadRead: string;
    let leadCreate: string;
    let leadUpdate: string;
    let leadAssign: string;
    let callRead: string;
    let callManage: string;
    let relationshipRead: string;
    let relationshipManage: string;
    let assistantUse: string;
    let assistantManage: string;
    let referralRead: string;
    let referralManage: string;
    let customerImport: string;
    let auditRead: string;
    let hrmsRead: string;
    let attendanceRead: string;
    let attendanceMark: string;
    let attendanceApprove: string;
    let leaveRead: string;
    let leaveApply: string;
    let leaveApprove: string;
    let payrollRead: string;
    let payrollManage: string;
    let payrollApprove: string;
    let kpiRead: string;
    let kpiManage: string;
    let hrmsEmployeeManage: string;
    let hrmsEmployeeRead: string;
    let hrmsAttendanceManage: string;
    let hrmsAttendanceRead: string;
    let hrmsLeaveManage: string;
    let hrmsLeaveRead: string;
    let hrmsLeaveApply: string;
    let hrmsPayrollProcess: string;
    let hrmsPayrollApprove: string;
    let hrmsPayrollRead: string;
    let hrmsKpiConfigure: string;
    let hrmsKpiRead: string;
    let hrmsAuditRead: string;
    let tenantRead: string;
    let tenantManage: string;
}
/** @typedef {typeof PERMISSIONS[keyof typeof PERMISSIONS]} PermissionCode */
/** @type {PermissionCode[]} */
export const PERMISSION_CODES: PermissionCode[];
export namespace PROPOSED_ROLE_PERMISSIONS {
    let SUPER_ADMIN: string[];
    let FOUNDER: string[];
    let MANAGER: string[];
    let AGENT: string[];
    let STAFF: string[];
    let DELIVERY: string[];
}
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
