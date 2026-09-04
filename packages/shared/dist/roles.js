"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_LABELS = exports.ROLE_CODES = void 0;
/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
exports.ROLE_CODES = ['FOUNDER', 'MANAGER', 'AGENT', 'STAFF'];
exports.ROLE_LABELS = {
    FOUNDER: 'Founder',
    MANAGER: 'Manager/Admin',
    AGENT: 'Telecaller/Agent',
    STAFF: 'Staff',
};
