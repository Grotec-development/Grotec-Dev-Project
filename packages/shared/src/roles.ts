/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
export const ROLE_CODES = ['FOUNDER', 'MANAGER', 'AGENT', 'STAFF'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  FOUNDER: 'Founder',
  MANAGER: 'Manager/Admin',
  AGENT: 'Telecaller/Agent',
  STAFF: 'Staff',
};
