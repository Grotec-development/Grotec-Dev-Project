export function toTechnicalRole(roleCode: any): any;
export function outranks(actorRole: any, targetRole: any): boolean;
export function isTopTier(roleCode: any): boolean;
/**
 * GROTEC FarmerOS Roles Definition
 * Section 5: GROTEC Roles & Permission Model
 *
 * Supports business-facing roles mapped cleanly to permission groups and
 * extendable without code changes.
 */
/**
 * @typedef {'SUPER_ADMIN' | 'FOUNDER' | 'MANAGER' | 'AGENT' | 'STAFF' | 'DELIVERY' | 'FARMER_SUCCESS_MANAGER' | 'GROUP_LEADER' | 'FSE' | 'HR_ADMIN' | 'ACCOUNTS_FINANCE' | 'TECHNICAL_AGRONOMY' | 'STORES_DISPATCH'} RoleCode
 */
export const ROLE_CODES: readonly ["SUPER_ADMIN", "FOUNDER", "MANAGER", "AGENT", "STAFF", "DELIVERY", "FARMER_SUCCESS_MANAGER", "GROUP_LEADER", "FSE", "HR_ADMIN", "ACCOUNTS_FINANCE", "TECHNICAL_AGRONOMY", "STORES_DISPATCH"];
export const GROTEC_BUSINESS_ROLES: {
    code: string;
    label: string;
    technicalRole: string;
    description: string;
}[];
export namespace ROLE_LABELS {
    let SUPER_ADMIN: string;
    let FOUNDER: string;
    let MANAGER: string;
    let AGENT: string;
    let STAFF: string;
    let DELIVERY: string;
    let FARMER_SUCCESS_MANAGER: string;
    let GROUP_LEADER: string;
    let FSE: string;
    let HR_ADMIN: string;
    let ACCOUNTS_FINANCE: string;
    let TECHNICAL_AGRONOMY: string;
    let STORES_DISPATCH: string;
}
export namespace ROLE_RANK {
    let SUPER_ADMIN_1: number;
    export { SUPER_ADMIN_1 as SUPER_ADMIN };
    let FOUNDER_1: number;
    export { FOUNDER_1 as FOUNDER };
    let MANAGER_1: number;
    export { MANAGER_1 as MANAGER };
    let FARMER_SUCCESS_MANAGER_1: number;
    export { FARMER_SUCCESS_MANAGER_1 as FARMER_SUCCESS_MANAGER };
    let GROUP_LEADER_1: number;
    export { GROUP_LEADER_1 as GROUP_LEADER };
    let AGENT_1: number;
    export { AGENT_1 as AGENT };
    let FSE_1: number;
    export { FSE_1 as FSE };
    let STAFF_1: number;
    export { STAFF_1 as STAFF };
    let HR_ADMIN_1: number;
    export { HR_ADMIN_1 as HR_ADMIN };
    let ACCOUNTS_FINANCE_1: number;
    export { ACCOUNTS_FINANCE_1 as ACCOUNTS_FINANCE };
    let TECHNICAL_AGRONOMY_1: number;
    export { TECHNICAL_AGRONOMY_1 as TECHNICAL_AGRONOMY };
    let STORES_DISPATCH_1: number;
    export { STORES_DISPATCH_1 as STORES_DISPATCH };
    let DELIVERY_1: number;
    export { DELIVERY_1 as DELIVERY };
}
export type RoleCode = "SUPER_ADMIN" | "FOUNDER" | "MANAGER" | "AGENT" | "STAFF" | "DELIVERY" | "FARMER_SUCCESS_MANAGER" | "GROUP_LEADER" | "FSE" | "HR_ADMIN" | "ACCOUNTS_FINANCE" | "TECHNICAL_AGRONOMY" | "STORES_DISPATCH";
