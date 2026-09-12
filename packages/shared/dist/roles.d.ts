/**
 * Returns true if actor strictly outranks targetRole.
 * Agents and Delivery staff are peers and do not outrank each other.
 */
export function outranks(actorRole: any, targetRole: any): boolean;
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
export function isTopTier(roleCode: any): boolean;
/**
 * Login roles per the PRD, plus SUPER_ADMIN: a break-glass role added on top of
 * the PRD's Phase 1 hierarchy that outranks even Founder and holds every
 * permission in the system, including ones normally hardcoded to "Founder
 * only" (see isTopTier below). Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 *
 * @typedef {'SUPER_ADMIN'|'FOUNDER'|'MANAGER'|'AGENT'|'STAFF'|'DELIVERY'} RoleCode
 */
export const ROLE_CODES: string[];
export namespace ROLE_LABELS {
    let SUPER_ADMIN: string;
    let FOUNDER: string;
    let MANAGER: string;
    let AGENT: string;
    let STAFF: string;
    let DELIVERY: string;
}
export namespace ROLE_RANK {
    let SUPER_ADMIN_1: number;
    export { SUPER_ADMIN_1 as SUPER_ADMIN };
    let FOUNDER_1: number;
    export { FOUNDER_1 as FOUNDER };
    let MANAGER_1: number;
    export { MANAGER_1 as MANAGER };
    let AGENT_1: number;
    export { AGENT_1 as AGENT };
    let STAFF_1: number;
    export { STAFF_1 as STAFF };
    let DELIVERY_1: number;
    export { DELIVERY_1 as DELIVERY };
}
/**
 * Login roles per the PRD, plus SUPER_ADMIN: a break-glass role added on top of
 * the PRD's Phase 1 hierarchy that outranks even Founder and holds every
 * permission in the system, including ones normally hardcoded to "Founder
 * only" (see isTopTier below). Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
export type RoleCode = "SUPER_ADMIN" | "FOUNDER" | "MANAGER" | "AGENT" | "STAFF" | "DELIVERY";
