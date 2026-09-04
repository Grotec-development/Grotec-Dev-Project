"use strict";
/** Mirrors the PostgreSQL enums in apps/api/prisma/schema.prisma. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAGINATION = exports.AuditAction = exports.AuditEntityType = exports.CallDisconnectReason = exports.MessageType = exports.MessageStatus = exports.FollowUpStatus = exports.NextAction = exports.CALL_OUTCOMES = exports.CallOutcome = exports.CallDirection = exports.TERMINAL_CALL_STATUSES = exports.ACTIVE_CALL_STATUSES = exports.CallStatus = exports.LeadStatus = exports.PhoneKind = exports.CustomerStatus = exports.EmployeeStatus = void 0;
exports.EmployeeStatus = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
};
exports.CustomerStatus = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
};
exports.PhoneKind = {
    MOBILE: 'MOBILE',
    OTHER: 'OTHER',
};
/**
 * Lead status vocabulary is PROVISIONAL (Month 1 foundation). It must map onto the
 * Month 3 call-outcome flow (Interested / Not Interested / Not Answered) cleanly;
 * see docs/open-items.md item 5.
 */
exports.LeadStatus = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
};
/**
 * Canonical call states (PRD §6.3.3). The PRD marks the final list provider-
 * dependent (open item); these are the canonical states the CRM understands.
 * Providers map their own vocabulary onto these — see docs/open-items.md.
 */
exports.CallStatus = {
    DIALING: 'DIALING',
    RINGING: 'RINGING',
    CONNECTED: 'CONNECTED',
    ENDED: 'ENDED',
    NOT_ANSWERED: 'NOT_ANSWERED',
    FAILED: 'FAILED',
};
exports.ACTIVE_CALL_STATUSES = ['DIALING', 'RINGING', 'CONNECTED'];
exports.TERMINAL_CALL_STATUSES = ['ENDED', 'NOT_ANSWERED', 'FAILED'];
exports.CallDirection = {
    OUTBOUND: 'OUTBOUND',
};
/** Exactly three call outcomes (PRD §6.3.6). Outcome and Next Action are separate fields. */
exports.CallOutcome = {
    INTERESTED: 'INTERESTED',
    NOT_INTERESTED: 'NOT_INTERESTED',
    NOT_ANSWERED: 'NOT_ANSWERED',
};
exports.CALL_OUTCOMES = ['INTERESTED', 'NOT_INTERESTED', 'NOT_ANSWERED'];
/** Next Action for an Interested outcome (PRD §6.3.7) — exactly one, no default. */
exports.NextAction = {
    CALLBACK: 'CALLBACK',
    SALES: 'SALES',
};
/** Follow-up lifecycle (provisional — vocabulary not fixed by the PRD). */
exports.FollowUpStatus = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
};
/** Outbound message lifecycle (integration failures are stored, never silent). */
exports.MessageStatus = {
    PENDING: 'PENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
};
/** Message types the CRM can auto-send (extended by later modules). */
exports.MessageType = {
    PRODUCT_DETAILS: 'PRODUCT_DETAILS',
};
/** Why an outbound call ended (Month 2: agent-ended or provider terminal). */
exports.CallDisconnectReason = {
    AGENT_ENDED: 'AGENT_ENDED',
    NOT_ANSWERED: 'NOT_ANSWERED',
    FAILED: 'FAILED',
    UNKNOWN: 'UNKNOWN',
};
/** Entity types written to the audit log. */
exports.AuditEntityType = {
    AUTH: 'AUTH',
    EMPLOYEE: 'EMPLOYEE',
    CUSTOMER: 'CUSTOMER',
    CUSTOMER_PHONE: 'CUSTOMER_PHONE',
    CUSTOMER_LOCATION: 'CUSTOMER_LOCATION',
    CUSTOMER_CROP: 'CUSTOMER_CROP',
    CROP: 'CROP',
    CROP_PRODUCT_GUIDANCE: 'CROP_PRODUCT_GUIDANCE',
    ASSISTANT: 'ASSISTANT',
    LEAD: 'LEAD',
    CALL: 'CALL',
    CALL_NOTE: 'CALL_NOTE',
    FOLLOW_UP: 'FOLLOW_UP',
    RELATIONSHIP_OWNERSHIP: 'RELATIONSHIP_OWNERSHIP',
    OUTBOUND_MESSAGE: 'OUTBOUND_MESSAGE',
    CUSTOMER_NOTE: 'CUSTOMER_NOTE',
};
exports.AuditAction = {
    // Auth
    LOGIN_SUCCESS: 'login.success',
    LOGIN_FAILED: 'login.failed',
    LOGOUT: 'logout',
    PASSWORD_CHANGED: 'password.changed',
    // CRUD
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    ACTIVATED: 'activated',
    DEACTIVATED: 'deactivated',
    // Ownership
    OWNERSHIP_ASSIGNED: 'ownership.assigned',
    // Calls (Month 2)
    CALL_PLACED: 'call.placed',
    CALL_ENDED: 'call.ended',
    CALL_LINKED: 'call.linked',
    NOTE_ADDED: 'call.note_added',
    // AI Assistant (question + answer, answered or unavailable)
    ASSISTANT_CHAT: 'assistant.chat',
    // Call outcomes + follow-ups (Month 3)
    CALL_OUTCOME_RECORDED: 'call.outcome_recorded',
    FOLLOW_UP_CREATED: 'followup.created',
    FOLLOW_UP_COMPLETED: 'followup.completed',
    FOLLOW_UP_CANCELLED: 'followup.cancelled',
    RELATIONSHIP_ASSIGNED: 'relationship.assigned',
    RELATIONSHIP_RELEASED: 'relationship.released',
    CUSTOMER_NOTE_ADDED: 'customer.note_added',
    MESSAGE_SENT: 'message.sent',
    MESSAGE_FAILED: 'message.failed',
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
};
