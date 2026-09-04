/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
export declare const ROLE_CODES: readonly ["FOUNDER", "MANAGER", "AGENT", "STAFF"];
export type RoleCode = (typeof ROLE_CODES)[number];
export declare const ROLE_LABELS: Record<RoleCode, string>;
