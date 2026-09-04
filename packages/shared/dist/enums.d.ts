/** Mirrors the PostgreSQL enums in apps/api/prisma/schema.prisma. */
export declare const EmployeeStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly INACTIVE: "INACTIVE";
};
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];
export declare const CustomerStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly INACTIVE: "INACTIVE";
};
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];
export declare const PhoneKind: {
    readonly MOBILE: "MOBILE";
    readonly OTHER: "OTHER";
};
export type PhoneKind = (typeof PhoneKind)[keyof typeof PhoneKind];
/**
 * Lead status vocabulary is PROVISIONAL (Month 1 foundation). It must map onto the
 * Month 3 call-outcome flow (Interested / Not Interested / Not Answered) cleanly;
 * see docs/open-items.md item 5.
 */
export declare const LeadStatus: {
    readonly OPEN: "OPEN";
    readonly CLOSED: "CLOSED";
};
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
/**
 * Canonical call states (PRD §6.3.3). The PRD marks the final list provider-
 * dependent (open item); these are the canonical states the CRM understands.
 * Providers map their own vocabulary onto these — see docs/open-items.md.
 */
export declare const CallStatus: {
    readonly DIALING: "DIALING";
    readonly RINGING: "RINGING";
    readonly CONNECTED: "CONNECTED";
    readonly ENDED: "ENDED";
    readonly NOT_ANSWERED: "NOT_ANSWERED";
    readonly FAILED: "FAILED";
};
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];
export declare const ACTIVE_CALL_STATUSES: readonly CallStatus[];
export declare const TERMINAL_CALL_STATUSES: readonly CallStatus[];
export declare const CallDirection: {
    readonly OUTBOUND: "OUTBOUND";
};
export type CallDirection = (typeof CallDirection)[keyof typeof CallDirection];
/** Exactly three call outcomes (PRD §6.3.6). Outcome and Next Action are separate fields. */
export declare const CallOutcome: {
    readonly INTERESTED: "INTERESTED";
    readonly NOT_INTERESTED: "NOT_INTERESTED";
    readonly NOT_ANSWERED: "NOT_ANSWERED";
};
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];
export declare const CALL_OUTCOMES: readonly CallOutcome[];
/** Next Action for an Interested outcome (PRD §6.3.7) — exactly one, no default. */
export declare const NextAction: {
    readonly CALLBACK: "CALLBACK";
    readonly SALES: "SALES";
};
export type NextAction = (typeof NextAction)[keyof typeof NextAction];
/** Follow-up lifecycle (provisional — vocabulary not fixed by the PRD). */
export declare const FollowUpStatus: {
    readonly PENDING: "PENDING";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];
/** Outbound message lifecycle (integration failures are stored, never silent). */
export declare const MessageStatus: {
    readonly PENDING: "PENDING";
    readonly SENT: "SENT";
    readonly FAILED: "FAILED";
};
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
/** Message types the CRM can auto-send (extended by later modules). */
export declare const MessageType: {
    readonly PRODUCT_DETAILS: "PRODUCT_DETAILS";
};
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
/** Why an outbound call ended (Month 2: agent-ended or provider terminal). */
export declare const CallDisconnectReason: {
    readonly AGENT_ENDED: "AGENT_ENDED";
    readonly NOT_ANSWERED: "NOT_ANSWERED";
    readonly FAILED: "FAILED";
    readonly UNKNOWN: "UNKNOWN";
};
export type CallDisconnectReason = (typeof CallDisconnectReason)[keyof typeof CallDisconnectReason];
/** Entity types written to the audit log. */
export declare const AuditEntityType: {
    readonly AUTH: "AUTH";
    readonly EMPLOYEE: "EMPLOYEE";
    readonly CUSTOMER: "CUSTOMER";
    readonly CUSTOMER_PHONE: "CUSTOMER_PHONE";
    readonly CUSTOMER_LOCATION: "CUSTOMER_LOCATION";
    readonly CUSTOMER_CROP: "CUSTOMER_CROP";
    readonly CROP: "CROP";
    readonly CROP_PRODUCT_GUIDANCE: "CROP_PRODUCT_GUIDANCE";
    readonly ASSISTANT: "ASSISTANT";
    readonly LEAD: "LEAD";
    readonly CALL: "CALL";
    readonly CALL_NOTE: "CALL_NOTE";
    readonly FOLLOW_UP: "FOLLOW_UP";
    readonly RELATIONSHIP_OWNERSHIP: "RELATIONSHIP_OWNERSHIP";
    readonly OUTBOUND_MESSAGE: "OUTBOUND_MESSAGE";
    readonly CUSTOMER_NOTE: "CUSTOMER_NOTE";
};
export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];
export declare const AuditAction: {
    readonly LOGIN_SUCCESS: "login.success";
    readonly LOGIN_FAILED: "login.failed";
    readonly LOGOUT: "logout";
    readonly PASSWORD_CHANGED: "password.changed";
    readonly CREATED: "created";
    readonly UPDATED: "updated";
    readonly DELETED: "deleted";
    readonly ACTIVATED: "activated";
    readonly DEACTIVATED: "deactivated";
    readonly OWNERSHIP_ASSIGNED: "ownership.assigned";
    readonly CALL_PLACED: "call.placed";
    readonly CALL_ENDED: "call.ended";
    readonly CALL_LINKED: "call.linked";
    readonly NOTE_ADDED: "call.note_added";
    readonly ASSISTANT_CHAT: "assistant.chat";
    readonly CALL_OUTCOME_RECORDED: "call.outcome_recorded";
    readonly FOLLOW_UP_CREATED: "followup.created";
    readonly FOLLOW_UP_COMPLETED: "followup.completed";
    readonly FOLLOW_UP_CANCELLED: "followup.cancelled";
    readonly RELATIONSHIP_ASSIGNED: "relationship.assigned";
    readonly RELATIONSHIP_RELEASED: "relationship.released";
    readonly CUSTOMER_NOTE_ADDED: "customer.note_added";
    readonly MESSAGE_SENT: "message.sent";
    readonly MESSAGE_FAILED: "message.failed";
};
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_PAGE_SIZE: 20;
    readonly MAX_PAGE_SIZE: 100;
};
