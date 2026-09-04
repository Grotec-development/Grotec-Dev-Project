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
    // Audit
    auditRead: 'audit.read',
};
exports.PERMISSION_CODES = Object.values(exports.PERMISSIONS);
/**
 * Phase 1 role→permission matrix per PRD v2.1 §5.2 (docs/reference/prd-v2.1.md).
 * - CRM records: Founder/Manager all; Agent assigned-only (scoped in services); Staff No.
 * - Audit logs / security settings: Founder only.
 * - AI Assistant content management (crop/product guidance): Founder/Manager.
 * Staff is an HRMS/payroll Phase 1 role with no CRM permissions until HRMS ships
 * (permission boundaries remain an open item, PRD §5.1.4).
 */
exports.PROPOSED_ROLE_PERMISSIONS = {
    FOUNDER: exports.PERMISSION_CODES,
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
        exports.PERMISSIONS.assistantUse,
    ],
    // PRD §5.2: Staff has no CRM capability in Phase 1 (HRMS/payroll role).
    STAFF: [],
};
