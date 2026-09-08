"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = exports.ROLE_LABELS = exports.ROLE_CODES = void 0;
exports.outranks = outranks;
/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 *
 * @typedef {'FOUNDER'|'MANAGER'|'AGENT'|'STAFF'|'DELIVERY'} RoleCode
 */
exports.ROLE_CODES = ['FOUNDER', 'MANAGER', 'AGENT', 'STAFF', 'DELIVERY'];
exports.ROLE_LABELS = {
    FOUNDER: 'Founder',
    MANAGER: 'Admin/Manager',
    AGENT: 'Telecaller/Agent',
    STAFF: 'Office/Operations Staff',
    DELIVERY: 'Delivery Service Person',
};
/**
 * Hierarchy rank per Master Build Prompt:
 * FOUNDER (0) > MANAGER (1) > AGENT (2) = STAFF (2) = DELIVERY (2).
 * Lower number = higher authority.
 */
exports.ROLE_RANK = {
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
