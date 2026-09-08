/**
 * Returns true if actor strictly outranks targetRole.
 * Agents and Delivery staff are peers and do not outrank each other.
 */
export function outranks(actorRole: any, targetRole: any): boolean;
/**
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 *
 * @typedef {'FOUNDER'|'MANAGER'|'AGENT'|'STAFF'|'DELIVERY'} RoleCode
 */
export const ROLE_CODES: string[];
export namespace ROLE_LABELS {
    let FOUNDER: string;
    let MANAGER: string;
    let AGENT: string;
    let STAFF: string;
    let DELIVERY: string;
}
export namespace ROLE_RANK {
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
 * Phase 1 login roles per the PRD. Relationship Manager is an ownership concept,
 * NOT a login role (see docs/architecture.md).
 */
export type RoleCode = "FOUNDER" | "MANAGER" | "AGENT" | "STAFF" | "DELIVERY";
