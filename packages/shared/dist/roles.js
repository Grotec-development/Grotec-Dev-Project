"use strict";
/**
 * GROTEC FarmerOS Roles Definition
 * Section 5: GROTEC Roles & Permission Model
 *
 * Supports business-facing roles mapped cleanly to permission groups and
 * extendable without code changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = exports.ROLE_LABELS = exports.GROTEC_BUSINESS_ROLES = exports.ROLE_CODES = void 0;
exports.toTechnicalRole = toTechnicalRole;
exports.outranks = outranks;
exports.isTopTier = isTopTier;
/**
 * @typedef {'SUPER_ADMIN' | 'FOUNDER' | 'MANAGER' | 'AGENT' | 'STAFF' | 'DELIVERY' | 'FARMER_SUCCESS_MANAGER' | 'GROUP_LEADER' | 'FSE' | 'HR_ADMIN' | 'ACCOUNTS_FINANCE' | 'TECHNICAL_AGRONOMY' | 'STORES_DISPATCH'} RoleCode
 */
exports.ROLE_CODES = ([
    'SUPER_ADMIN',
    'FOUNDER',
    'MANAGER',
    'AGENT',
    'STAFF',
    'DELIVERY',
    // Official GROTEC Business Roles
    'FARMER_SUCCESS_MANAGER',
    'GROUP_LEADER',
    'FSE',
    'HR_ADMIN',
    'ACCOUNTS_FINANCE',
    'TECHNICAL_AGRONOMY',
    'STORES_DISPATCH',
]);
exports.GROTEC_BUSINESS_ROLES = [
    { code: 'SUPER_ADMIN', label: 'Founder / Super Admin', technicalRole: 'SUPER_ADMIN', description: 'Full system ownership & break-glass access' },
    { code: 'FOUNDER', label: 'Founder', technicalRole: 'FOUNDER', description: 'Executive oversight, approvals, and strategic governance' },
    { code: 'FARMER_SUCCESS_MANAGER', label: 'Farmer Success Manager', technicalRole: 'MANAGER', description: 'Telecalling operations, assignment, conversion & performance management' },
    { code: 'GROUP_LEADER', label: 'Group Leader (GL)', technicalRole: 'MANAGER', description: 'Team supervisory oversight, queue balancing & quality coaching' },
    { code: 'FSE', label: 'Farmer Success Executive (FSE)', technicalRole: 'AGENT', description: 'Farmer advisory, outbound telecalling, wrap-up & follow-ups' },
    { code: 'HR_ADMIN', label: 'HR / Admin', technicalRole: 'STAFF', description: 'Staff records, biometric attendance, leave & payroll processing' },
    { code: 'ACCOUNTS_FINANCE', label: 'Accounts / Finance', technicalRole: 'STAFF', description: 'Invoicing, payment reconciliation & collections' },
    { code: 'TECHNICAL_AGRONOMY', label: 'Technical / Agronomy', technicalRole: 'STAFF', description: 'Crop knowledge base curation, dosage guidance & AI prompt grounding' },
    { code: 'STORES_DISPATCH', label: 'Stores / Dispatch', technicalRole: 'STAFF', description: 'Inventory stock movements, vehicle loading & trip dispatch' },
    { code: 'DELIVERY', label: 'Delivery (future)', technicalRole: 'DELIVERY', description: 'Doorstep delivery execution, POD signature & vehicle stock reconciliation' },
];
exports.ROLE_LABELS = {
    SUPER_ADMIN: 'Founder / Super Admin',
    FOUNDER: 'Founder',
    MANAGER: 'Admin / Manager',
    AGENT: 'Telecaller / Agent',
    STAFF: 'Office / Operations Staff',
    DELIVERY: 'Delivery Service Person',
    FARMER_SUCCESS_MANAGER: 'Farmer Success Manager',
    GROUP_LEADER: 'Group Leader (GL)',
    FSE: 'Farmer Success Executive (FSE)',
    HR_ADMIN: 'HR / Admin',
    ACCOUNTS_FINANCE: 'Accounts / Finance',
    TECHNICAL_AGRONOMY: 'Technical / Agronomy',
    STORES_DISPATCH: 'Stores / Dispatch',
};
exports.ROLE_RANK = {
    SUPER_ADMIN: -1,
    FOUNDER: 0,
    MANAGER: 1,
    FARMER_SUCCESS_MANAGER: 1,
    GROUP_LEADER: 1,
    AGENT: 2,
    FSE: 2,
    STAFF: 2,
    HR_ADMIN: 2,
    ACCOUNTS_FINANCE: 2,
    TECHNICAL_AGRONOMY: 2,
    STORES_DISPATCH: 2,
    DELIVERY: 2,
};
function toTechnicalRole(roleCode) {
    switch (roleCode) {
        case 'FSE':
            return 'AGENT';
        case 'FARMER_SUCCESS_MANAGER':
        case 'GROUP_LEADER':
            return 'MANAGER';
        case 'HR_ADMIN':
        case 'ACCOUNTS_FINANCE':
        case 'TECHNICAL_AGRONOMY':
        case 'STORES_DISPATCH':
            return 'STAFF';
        default:
            return roleCode;
    }
}
function outranks(actorRole, targetRole) {
    const actorRank = exports.ROLE_RANK[actorRole] ?? 99;
    const targetRank = exports.ROLE_RANK[targetRole] ?? 99;
    return actorRank < targetRank;
}
function isTopTier(roleCode) {
    return roleCode === 'FOUNDER' || roleCode === 'SUPER_ADMIN';
}
