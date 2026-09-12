"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = exports.ROLE_LABELS = exports.ROLE_CODES = void 0;
exports.outranks = outranks;
exports.isTopTier = isTopTier;
/**
 * Login roles per the PRD, plus SUPER_ADMIN: a break-glass role added on top of
 * the PRD's Phase 1 hierarchy that outranks even Founder and holds every
 * permission in the system, including ones normally hardcoded to "Founder
 * only" (see isTopTier below). Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 *
 * @typedef {'SUPER_ADMIN'|'FOUNDER'|'MANAGER'|'AGENT'|'STAFF'|'DELIVERY'} RoleCode
 */
exports.ROLE_CODES = ['SUPER_ADMIN', 'FOUNDER', 'MANAGER', 'AGENT', 'STAFF', 'DELIVERY'];
exports.ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    FOUNDER: 'Founder',
    MANAGER: 'Admin/Manager',
    AGENT: 'Telecaller/Agent',
    STAFF: 'Office/Operations Staff',
    DELIVERY: 'Delivery Service Person',
};
/**
 * Hierarchy rank per Master Build Prompt, extended with SUPER_ADMIN above Founder:
 * SUPER_ADMIN (-1) > FOUNDER (0) > MANAGER (1) > AGENT (2) = STAFF (2) = DELIVERY (2).
 * Lower number = higher authority.
 */
exports.ROLE_RANK = {
    SUPER_ADMIN: -1,
    FOUNDER: 0,
    MANAGER: 1,
    AGENT: 2,
    STAFF: 2,
    DELIVERY: 2,
};
/**
 * Returns true if actor strictly outranks targetRole.
 * Agents and Delivery staff are peers and do not outrank each other.
 */
function outranks(actorRole, targetRole) {
    return exports.ROLE_RANK[actorRole] < exports.ROLE_RANK[targetRole];
}
/**
 * Many service methods hardcode `actor.roleCode === 'FOUNDER'` as a stricter,
 * business-rule-level gate on top of the permission-guard layer (e.g. "only the
 * Founder can reset a password" per PRD §5.1.2), rather than deriving it from
 * ROLE_RANK. SUPER_ADMIN is meant to have full access everywhere Founder does
 * plus the ability to override Founder specifically, so every one of those
 * hardcoded checks needs to also recognize SUPER_ADMIN. Centralizing the check
 * here keeps that "Founder-tier" concept in one place instead of duplicating
 * `=== 'FOUNDER' || === 'SUPER_ADMIN'` at every call site.
 */
function isTopTier(roleCode) {
    return roleCode === 'FOUNDER' || roleCode === 'SUPER_ADMIN';
}
