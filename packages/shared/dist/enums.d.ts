export namespace EmployeeStatus {
    let ACTIVE: string;
    let INACTIVE: string;
}
export namespace CustomerStatus {
    let ACTIVE_1: string;
    export { ACTIVE_1 as ACTIVE };
    let INACTIVE_1: string;
    export { INACTIVE_1 as INACTIVE };
}
export namespace PhoneKind {
    let MOBILE: string;
    let OTHER: string;
}
export namespace LeadStatus {
    let OPEN: string;
    let CLOSED: string;
}
export namespace CallStatus {
    let DIALING: string;
    let RINGING: string;
    let CONNECTED: string;
    let ENDED: string;
    let NOT_ANSWERED: string;
    let FAILED: string;
}
export const ACTIVE_CALL_STATUSES: string[];
export const TERMINAL_CALL_STATUSES: string[];
export namespace CallDirection {
    let OUTBOUND: string;
}
export namespace CallOutcome {
    export let INTERESTED: string;
    export let NOT_INTERESTED: string;
    let NOT_ANSWERED_1: string;
    export { NOT_ANSWERED_1 as NOT_ANSWERED };
}
export const CALL_OUTCOMES: string[];
export namespace NextAction {
    let CALLBACK: string;
    let SALES: string;
}
export namespace FollowUpStatus {
    let PENDING: string;
    let COMPLETED: string;
    let CANCELLED: string;
}
export namespace MessageStatus {
    let PENDING_1: string;
    export { PENDING_1 as PENDING };
    export let SENT: string;
    let FAILED_1: string;
    export { FAILED_1 as FAILED };
}
export namespace EmployeeEmploymentStatus {
    let ACTIVE_2: string;
    export { ACTIVE_2 as ACTIVE };
    export let PROBATION: string;
    export let ON_LEAVE: string;
    export let TERMINATED: string;
}
export namespace MessageType {
    let PRODUCT_DETAILS: string;
    let FOLLOWUP_REMINDER: string;
    let ATTENDANCE_DECISION: string;
    let LEAVE_DECISION: string;
    let PAYROLL_STATUS: string;
}
export namespace CallDisconnectReason {
    export let AGENT_ENDED: string;
    let NOT_ANSWERED_2: string;
    export { NOT_ANSWERED_2 as NOT_ANSWERED };
    let FAILED_2: string;
    export { FAILED_2 as FAILED };
    export let UNKNOWN: string;
}
export namespace AuditEntityType {
    let AUTH: string;
    let EMPLOYEE: string;
    let CUSTOMER: string;
    let CUSTOMER_PHONE: string;
    let CUSTOMER_LOCATION: string;
    let CUSTOMER_CROP: string;
    let CROP: string;
    let CROP_PRODUCT_GUIDANCE: string;
    let ASSISTANT: string;
    let LEAD: string;
    let CALL: string;
    let CALL_NOTE: string;
    let FOLLOW_UP: string;
    let RELATIONSHIP_OWNERSHIP: string;
    let OUTBOUND_MESSAGE: string;
    let CUSTOMER_NOTE: string;
    let REFERRAL: string;
}
export namespace AuditAction {
    export let LOGIN_SUCCESS: string;
    export let LOGIN_FAILED: string;
    export let LOGOUT: string;
    export let PASSWORD_CHANGED: string;
    export let REFRESH_REUSED: string;
    export let SESSION_IDLE_TIMEOUT: string;
    export let CREATED: string;
    export let UPDATED: string;
    export let DELETED: string;
    export let ACTIVATED: string;
    export let DEACTIVATED: string;
    export let OWNERSHIP_ASSIGNED: string;
    export let CALL_PLACED: string;
    export let CALL_ENDED: string;
    export let CALL_LINKED: string;
    export let NOTE_ADDED: string;
    export let ASSISTANT_CHAT: string;
    export let CALL_OUTCOME_RECORDED: string;
    export let FOLLOW_UP_CREATED: string;
    export let FOLLOW_UP_COMPLETED: string;
    export let FOLLOW_UP_CANCELLED: string;
    export let RELATIONSHIP_ASSIGNED: string;
    export let RELATIONSHIP_RELEASED: string;
    export let CUSTOMER_NOTE_ADDED: string;
    export let MESSAGE_SENT: string;
    export let MESSAGE_FAILED: string;
    export let EMPLOYEE_CREATED: string;
    export let EMPLOYEE_UPDATED: string;
    export let EMPLOYEE_TERMINATED: string;
    let TERMINATED_1: string;
    export { TERMINATED_1 as TERMINATED };
    export let DOCUMENT_UPLOADED: string;
    export let DOCUMENT_DELETED: string;
    export let EMPLOYEE_NOTE_ADDED: string;
    export let HISTORY_RECORDED: string;
    export let DISCIPLINARY: string;
    export let ATTENDANCE_MARKED: string;
    export let ATTENDANCE_CORRECTED: string;
    export let ATTENDANCE_APPROVED: string;
    export let ATTENDANCE_REJECTED: string;
    export let ATTENDANCE_SYNCED_ESSL: string;
    export let LEAVE_APPLIED: string;
    export let LEAVE_APPROVED: string;
    export let LEAVE_REJECTED: string;
    export let KPI_TARGET_CREATED: string;
    export let KPI_TARGET_SET: string;
    export let KPI_SCORE_FROZEN: string;
    export let KPI_COMPUTED: string;
    export let PAYROLL_GENERATED: string;
    export let PAYROLL_APPROVED: string;
    export let PAYROLL_PUBLISHED: string;
    export let REFERRAL_CREATED: string;
}
export namespace PAGINATION {
    let DEFAULT_PAGE: number;
    let DEFAULT_PAGE_SIZE: number;
    let MAX_PAGE_SIZE: number;
}
/**
 * PRD §6.5.2 problem/issue taxonomy — configurable vocabulary, starter set fixed.
 * @typedef {'PEST'|'DISEASE'|'NUTRIENT_DEFICIENCY'|'WEED'|'OTHER'} ProblemType
 */
/** @type {readonly ProblemType[]} */
export const PROBLEM_TYPES: readonly ProblemType[];
/**
 * PRD §6.5.2 content taxonomy used by the Crops catalog and Knowledge Base.
 * @typedef {'FIELD'|'TREE'|'PLANTATION'|'VEGETABLE'|'OTHER'} CropCategory
 */
/** @type {readonly CropCategory[]} */
export const CROP_CATEGORIES: readonly CropCategory[];
export namespace AttendanceStatus {
    let PRESENT: string;
    let ABSENT: string;
    let LATE: string;
    let HALF_DAY: string;
    let WEEKLY_OFF: string;
    let HOLIDAY: string;
    let LEAVE: string;
}
export namespace AttendanceSource {
    let ESSL: string;
    let MANUAL: string;
}
export namespace ApprovalStatus {
    let PENDING_2: string;
    export { PENDING_2 as PENDING };
    export let APPROVED: string;
    export let REJECTED: string;
}
export namespace LeaveStatus {
    let PENDING_3: string;
    export { PENDING_3 as PENDING };
    let APPROVED_1: string;
    export { APPROVED_1 as APPROVED };
    let REJECTED_1: string;
    export { REJECTED_1 as REJECTED };
    let CANCELLED_1: string;
    export { CANCELLED_1 as CANCELLED };
}
export namespace EmployeeHistoryType {
    let TRAINING: string;
    let WARNING: string;
    let COMMENDATION: string;
    let PROMOTION: string;
}
export namespace PayrollStatus {
    let IDLE: string;
    let GENERATED: string;
    let APPROVED_LOCKED: string;
    let PUBLISHED: string;
}
export namespace PayrollRunStatus { }
export namespace KpiMetricType {
    let CALLS_DIALED: string;
    let CALLS_CONNECTED: string;
    let LEADS_CONVERTED: string;
    let CONVERSION_RATE: string;
    let TOTAL_REVENUE: string;
    let CUSTOMER_QUALITY: string;
    let ATTENDANCE: string;
    let CRM_DISCIPLINE: string;
}
export namespace NotificationType {
    export let FOLLOW_UP_REMINDER: string;
    let PRODUCT_DETAILS_1: string;
    export { PRODUCT_DETAILS_1 as PRODUCT_DETAILS };
    export let ATTENDANCE_STATUS: string;
    export let LEAVE_STATUS: string;
    let PAYROLL_STATUS_1: string;
    export { PAYROLL_STATUS_1 as PAYROLL_STATUS };
}
export namespace OutboxStatus {
    let PENDING_4: string;
    export { PENDING_4 as PENDING };
    export let PROCESSING: string;
    export let PROCESSED: string;
    let FAILED_3: string;
    export { FAILED_3 as FAILED };
}
/**
 * PRD §6.5.2 problem/issue taxonomy — configurable vocabulary, starter set fixed.
 */
export type ProblemType = "PEST" | "DISEASE" | "NUTRIENT_DEFICIENCY" | "WEED" | "OTHER";
/**
 * PRD §6.5.2 content taxonomy used by the Crops catalog and Knowledge Base.
 */
export type CropCategory = "FIELD" | "TREE" | "PLANTATION" | "VEGETABLE" | "OTHER";
