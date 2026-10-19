"use strict";
/**
 * GROTEC FarmerOS Roles Definition
 * Clean 5-Tier Organizational Role Model:
 * 1. Founder (Super Admin): Full system ownership, executive oversight & break-glass access
 * 2. Manager: Manages Team Leaders, escalations review, managerial HR, reporting, delivery supervision & operations, inventory, sales business, finance
 * 3. Team Leader: Manages 4 telecallers under them, escalations, caller feedbacks, QA coaching & managerial roles
 * 4. Telecaller (Agent): Base employees, outbound calling queue, farmer advisory, order placement, escalation ticketing
 * 5. Delivery: Dedicated role for order dispatch full pipeline, vehicle loading & field delivery verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = exports.ROLE_LABELS = exports.GROTEC_BUSINESS_ROLES = exports.ROLE_CODES = void 0;
exports.toTechnicalRole = toTechnicalRole;
exports.outranks = outranks;
exports.isTopTier = isTopTier;
/**
 * @typedef {'SUPER_ADMIN' | 'FOUNDER' | 'MANAGER' | 'TEAM_LEADER' | 'AGENT' | 'DELIVERY' | 'GROUP_LEADER' | 'STAFF' | 'FSE' | 'FARMER_SUCCESS_MANAGER' | 'HR_ADMIN' | 'ACCOUNTS_FINANCE' | 'TECHNICAL_AGRONOMY' | 'STORES_DISPATCH'} RoleCode
 */
exports.ROLE_CODES = ([
    'SUPER_ADMIN',
    'FOUNDER',
    'MANAGER',
    'TEAM_LEADER',
    'AGENT',
    'DELIVERY',
    // Backward-compatibility aliases
    'GROUP_LEADER',
    'STAFF',
    'FSE',
    'FARMER_SUCCESS_MANAGER',
    'HR_ADMIN',
    'ACCOUNTS_FINANCE',
    'TECHNICAL_AGRONOMY',
    'STORES_DISPATCH',
]);
exports.GROTEC_BUSINESS_ROLES = [
    {
        code: 'FOUNDER',
        label: 'Founder (Super Admin)',
        technicalRole: 'FOUNDER',
        description: 'Full executive ownership, governance, settings, audit trails & break-glass access',
    },
    {
        code: 'MANAGER',
        label: 'Manager',
        technicalRole: 'MANAGER',
        description: 'Manages Team Leaders, reviews escalations, managerial HR works, reports, delivery supervision & operations, inventory, sales business, and finance',
    },
    {
        code: 'TEAM_LEADER',
        label: 'Team Leader',
        technicalRole: 'TEAM_LEADER',
        description: 'Supervises 4 telecallers under them, manages escalations, caller feedbacks, quality coaching, and caller managerial roles',
    },
    {
        code: 'AGENT',
        label: 'Telecaller',
        technicalRole: 'AGENT',
        description: 'Base telecaller employee: outbound calling queue, farmer advisory, order creation, and escalation ticketing',
    },
    {
        code: 'DELIVERY',
        label: 'Delivery Specialist',
        technicalRole: 'DELIVERY',
        description: 'Order dispatch full pipeline, vehicle loading, route delivery execution, customer verification, and digital POD',
    },
];
exports.ROLE_LABELS = {
    SUPER_ADMIN: 'Founder (Super Admin)',
    FOUNDER: 'Founder (Super Admin)',
    MANAGER: 'Manager',
    TEAM_LEADER: 'Team Leader',
    AGENT: 'Telecaller',
    DELIVERY: 'Delivery',
    // Backward compatibility aliases
    GROUP_LEADER: 'Team Leader',
    STAFF: 'Staff',
    FSE: 'Telecaller',
    FARMER_SUCCESS_MANAGER: 'Manager',
    HR_ADMIN: 'Manager (HR)',
    ACCOUNTS_FINANCE: 'Manager (Finance)',
    TECHNICAL_AGRONOMY: 'Technical / Agronomy',
    STORES_DISPATCH: 'Delivery / Dispatch',
};
exports.ROLE_RANK = {
    SUPER_ADMIN: -1,
    FOUNDER: 0,
    MANAGER: 1,
    TEAM_LEADER: 2,
    GROUP_LEADER: 2,
    AGENT: 3,
    FSE: 3,
    DELIVERY: 3,
    STAFF: 3,
    HR_ADMIN: 3,
    ACCOUNTS_FINANCE: 3,
    TECHNICAL_AGRONOMY: 3,
    STORES_DISPATCH: 3,
    FARMER_SUCCESS_MANAGER: 1,
};
function toTechnicalRole(roleCode) {
    switch (roleCode) {
        case 'SUPER_ADMIN':
            return 'FOUNDER';
        case 'FSE':
            return 'AGENT';
        case 'GROUP_LEADER':
            return 'TEAM_LEADER';
        case 'FARMER_SUCCESS_MANAGER':
        case 'HR_ADMIN':
        case 'ACCOUNTS_FINANCE':
        case 'STAFF':
            return 'MANAGER';
        case 'STORES_DISPATCH':
            return 'DELIVERY';
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
