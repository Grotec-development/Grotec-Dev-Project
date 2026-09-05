/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
export declare const ROLE_CODES: readonly ["FOUNDER", "MANAGER", "AGENT", "STAFF", "DELIVERY"];
export type RoleCode = (typeof ROLE_CODES)[number];
export declare const ROLE_LABELS: Record<RoleCode, string>;
/**
 * Hierarchy rank per Master Build Prompt:
 * FOUNDER (0) > MANAGER (1) > AGENT (2) = STAFF (2) = DELIVERY (2).
 * Lower number = higher authority.
 */
export declare const ROLE_RANK: Record<RoleCode, number>;
/**
 * Returns true if actor strictly outranks targetRole.
 * Agents and Delivery staff are peers and do not outrank each other.
 */
export declare function outranks(actorRole: RoleCode, targetRole: RoleCode): boolean;
