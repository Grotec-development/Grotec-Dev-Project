"use strict";
/** Mirrors the PostgreSQL enums in backend/prisma/schema.prisma. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxStatus = exports.NotificationType = exports.KpiMetricType = exports.PayrollRunStatus = exports.PayrollStatus = exports.EmployeeHistoryType = exports.LeaveStatus = exports.ApprovalStatus = exports.AttendanceSource = exports.AttendanceStatus = exports.CROP_CATEGORIES = exports.PROBLEM_TYPES = exports.PAGINATION = exports.AuditAction = exports.AuditEntityType = exports.CallDisconnectReason = exports.MessageType = exports.EmployeeEmploymentStatus = exports.MessageStatus = exports.FollowUpStatus = exports.NextAction = exports.CALL_OUTCOMES = exports.CallOutcome = exports.CallDirection = exports.TERMINAL_CALL_STATUSES = exports.ACTIVE_CALL_STATUSES = exports.CallStatus = exports.LeadStatus = exports.PhoneKind = exports.CustomerStatus = exports.EmployeeStatus = void 0;
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
exports.EmployeeEmploymentStatus = {
    ACTIVE: 'ACTIVE',
    PROBATION: 'PROBATION',
    ON_LEAVE: 'ON_LEAVE',
    TERMINATED: 'TERMINATED',
};
/** Message types the CRM can auto-send (extended by HRMS modules). */
exports.MessageType = {
    PRODUCT_DETAILS: 'PRODUCT_DETAILS',
    FOLLOWUP_REMINDER: 'FOLLOWUP_REMINDER',
    ATTENDANCE_DECISION: 'ATTENDANCE_DECISION',
    LEAVE_DECISION: 'LEAVE_DECISION',
    PAYROLL_STATUS: 'PAYROLL_STATUS',
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
    REFERRAL: 'REFERRAL',
};
exports.AuditAction = {
    // Auth
    LOGIN_SUCCESS: 'login.success',
    LOGIN_FAILED: 'login.failed',
    LOGOUT: 'logout',
    PASSWORD_CHANGED: 'password.changed',
    REFRESH_REUSED: 'auth.refresh_reused',
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
    // HRMS actions (Part 11)
    EMPLOYEE_CREATED: 'employee.created',
    EMPLOYEE_UPDATED: 'employee.updated',
    EMPLOYEE_TERMINATED: 'employee.terminated',
    TERMINATED: 'employee.terminated',
    DOCUMENT_UPLOADED: 'employee.document_uploaded',
    DOCUMENT_DELETED: 'employee.document_deleted',
    EMPLOYEE_NOTE_ADDED: 'employee.note_added',
    HISTORY_RECORDED: 'employee.history_added',
    DISCIPLINARY: 'employee.disciplinary',
    ATTENDANCE_MARKED: 'attendance.marked',
    ATTENDANCE_CORRECTED: 'attendance.corrected',
    ATTENDANCE_APPROVED: 'attendance.approved',
    ATTENDANCE_REJECTED: 'attendance.rejected',
    ATTENDANCE_SYNCED_ESSL: 'attendance.synced_essl',
    LEAVE_APPLIED: 'leave.applied',
    LEAVE_APPROVED: 'leave.approved',
    LEAVE_REJECTED: 'leave.rejected',
    KPI_TARGET_CREATED: 'kpi.target_created',
    KPI_TARGET_SET: 'kpi.target_set',
    KPI_SCORE_FROZEN: 'kpi.score_frozen',
    KPI_COMPUTED: 'kpi.computed',
    PAYROLL_GENERATED: 'payroll.generated',
    PAYROLL_APPROVED: 'payroll.approved',
    PAYROLL_PUBLISHED: 'payroll.published',
    // Referrals (Step 3B)
    REFERRAL_CREATED: 'referral.created',
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
};
/**
 * PRD §6.5.2 problem/issue taxonomy — configurable vocabulary, starter set fixed.
 * @typedef {'PEST'|'DISEASE'|'NUTRIENT_DEFICIENCY'|'WEED'|'OTHER'} ProblemType
 */
/** @type {readonly ProblemType[]} */
exports.PROBLEM_TYPES = ['PEST', 'DISEASE', 'NUTRIENT_DEFICIENCY', 'WEED', 'OTHER'];
/**
 * PRD §6.5.2 content taxonomy used by the Crops catalog and Knowledge Base.
 * @typedef {'FIELD'|'TREE'|'PLANTATION'|'VEGETABLE'|'OTHER'} CropCategory
 */
/** @type {readonly CropCategory[]} */
exports.CROP_CATEGORIES = ['FIELD', 'TREE', 'PLANTATION', 'VEGETABLE', 'OTHER'];
/** PRD §7.5 Attendance status vocabulary */
exports.AttendanceStatus = {
    PRESENT: 'PRESENT',
    ABSENT: 'ABSENT',
    LATE: 'LATE',
    HALF_DAY: 'HALF_DAY',
    WEEKLY_OFF: 'WEEKLY_OFF',
    HOLIDAY: 'HOLIDAY',
    LEAVE: 'LEAVE',
};
exports.AttendanceSource = {
    ESSL: 'ESSL',
    MANUAL: 'MANUAL',
};
exports.ApprovalStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
};
/** PRD §7.7 Leave request status */
exports.LeaveStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
};
/** PRD §7.9 Employee History type */
exports.EmployeeHistoryType = {
    TRAINING: 'TRAINING',
    WARNING: 'WARNING',
    COMMENDATION: 'COMMENDATION',
    PROMOTION: 'PROMOTION',
};
/** PRD §7.8.4 Monthly Payroll workflow states */
exports.PayrollStatus = {
    IDLE: 'IDLE',
    GENERATED: 'GENERATED',
    APPROVED_LOCKED: 'APPROVED_LOCKED',
    PUBLISHED: 'PUBLISHED',
};
exports.PayrollRunStatus = exports.PayrollStatus;
/** PRD §7.4.1 & §7.4.2 KPI metrics */
exports.KpiMetricType = {
    CALLS_DIALED: 'CALLS_DIALED',
    CALLS_CONNECTED: 'CALLS_CONNECTED',
    LEADS_CONVERTED: 'LEADS_CONVERTED',
    CONVERSION_RATE: 'CONVERSION_RATE',
    TOTAL_REVENUE: 'TOTAL_REVENUE',
    CUSTOMER_QUALITY: 'CUSTOMER_QUALITY',
    ATTENDANCE: 'ATTENDANCE',
    CRM_DISCIPLINE: 'CRM_DISCIPLINE',
};
/** PRD §9 Notification event types */
exports.NotificationType = {
    FOLLOW_UP_REMINDER: 'FOLLOW_UP_REMINDER',
    PRODUCT_DETAILS: 'PRODUCT_DETAILS',
    ATTENDANCE_STATUS: 'ATTENDANCE_STATUS',
    LEAVE_STATUS: 'LEAVE_STATUS',
    PAYROLL_STATUS: 'PAYROLL_STATUS',
};
/** Outbox event processing status (matches PostgreSQL enum OutboxStatus). */
exports.OutboxStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    PROCESSED: 'PROCESSED',
    FAILED: 'FAILED',
};
