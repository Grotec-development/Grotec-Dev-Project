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
};
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const PERMISSION_CODES: PermissionCode[];
/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - Audit logs / security settings: Founder only.
 * - AI Assistant content management (crop/product guidance): Founder/Manager.
 * Staff is an HRMS/payroll Phase 1 role with no CRM permissions until HRMS ships
 * (permission boundaries remain an open item, PRD §5.1.4).
 */
export declare const PROPOSED_ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]>;
