/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 *
 * @typedef {'FOUNDER'|'MANAGER'|'AGENT'|'STAFF'|'DELIVERY'} RoleCode
 */
export const ROLE_CODES = ['FOUNDER', 'MANAGER', 'AGENT', 'STAFF', 'DELIVERY'];

export const ROLE_LABELS = {
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
export const ROLE_RANK = {
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
export function outranks(actorRole, targetRole) {
  return ROLE_RANK[actorRole] < ROLE_RANK[targetRole];
}
