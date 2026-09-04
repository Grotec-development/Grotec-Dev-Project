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
  // AI Assistant (replaces the Knowledge Base screen): use = chat, manage = content
  assistantUse: 'assistant.use',
  assistantManage: 'assistant.manage',
  // Audit
  auditRead: 'audit.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const PERMISSION_CODES: PermissionCode[] = Object.values(PERMISSIONS);

/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - Audit logs / security settings: Founder only.
 * - AI Assistant content management (crop/product guidance): Founder/Manager.
 * Staff is an HRMS/payroll Phase 1 role with no CRM permissions until HRMS ships
 * (permission boundaries remain an open item, PRD §5.1.4).
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
    PERMISSIONS.assistantUse,
    PERMISSIONS.assistantManage,
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
  ],
  // PRD §5.2: Staff has no CRM capability in Phase 1 (HRMS/payroll role).
  STAFF: [],
};
