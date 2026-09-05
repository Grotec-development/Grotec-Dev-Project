/** Mirrors the PostgreSQL enums in apps/api/prisma/schema.prisma. */

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const PhoneKind = {
  MOBILE: 'MOBILE',
  OTHER: 'OTHER',
} as const;
export type PhoneKind = (typeof PhoneKind)[keyof typeof PhoneKind];

/**
 * Lead status vocabulary is PROVISIONAL (Month 1 foundation). It must map onto the
 * Month 3 call-outcome flow (Interested / Not Interested / Not Answered) cleanly;
 * see docs/open-items.md item 5.
 */
export const LeadStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

/**
 * Canonical call states (PRD §6.3.3). The PRD marks the final list provider-
 * dependent (open item); these are the canonical states the CRM understands.
 * Providers map their own vocabulary onto these — see docs/open-items.md.
 */
export const CallStatus = {
  DIALING: 'DIALING',
  RINGING: 'RINGING',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
  NOT_ANSWERED: 'NOT_ANSWERED',
  FAILED: 'FAILED',
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const ACTIVE_CALL_STATUSES: readonly CallStatus[] = ['DIALING', 'RINGING', 'CONNECTED'];
export const TERMINAL_CALL_STATUSES: readonly CallStatus[] = ['ENDED', 'NOT_ANSWERED', 'FAILED'];

export const CallDirection = {
  OUTBOUND: 'OUTBOUND',
} as const;
export type CallDirection = (typeof CallDirection)[keyof typeof CallDirection];

/** Exactly three call outcomes (PRD §6.3.6). Outcome and Next Action are separate fields. */
export const CallOutcome = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  NOT_ANSWERED: 'NOT_ANSWERED',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];

export const CALL_OUTCOMES: readonly CallOutcome[] = ['INTERESTED', 'NOT_INTERESTED', 'NOT_ANSWERED'];

/** Next Action for an Interested outcome (PRD §6.3.7) — exactly one, no default. */
export const NextAction = {
  CALLBACK: 'CALLBACK',
  SALES: 'SALES',
} as const;
export type NextAction = (typeof NextAction)[keyof typeof NextAction];

/** Follow-up lifecycle (provisional — vocabulary not fixed by the PRD). */
export const FollowUpStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

/** Outbound message lifecycle (integration failures are stored, never silent). */
export const MessageStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const EmployeeEmploymentStatus = {
  ACTIVE: 'ACTIVE',
  PROBATION: 'PROBATION',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
} as const;
export type EmployeeEmploymentStatus = (typeof EmployeeEmploymentStatus)[keyof typeof EmployeeEmploymentStatus];

/** Message types the CRM can auto-send (extended by HRMS modules). */
export const MessageType = {
  PRODUCT_DETAILS: 'PRODUCT_DETAILS',
  FOLLOWUP_REMINDER: 'FOLLOWUP_REMINDER',
  ATTENDANCE_DECISION: 'ATTENDANCE_DECISION',
  LEAVE_DECISION: 'LEAVE_DECISION',
  PAYROLL_STATUS: 'PAYROLL_STATUS',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** Why an outbound call ended (Month 2: agent-ended or provider terminal). */
export const CallDisconnectReason = {
  AGENT_ENDED: 'AGENT_ENDED',
  NOT_ANSWERED: 'NOT_ANSWERED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type CallDisconnectReason = (typeof CallDisconnectReason)[keyof typeof CallDisconnectReason];

/** Entity types written to the audit log. */
export const AuditEntityType = {
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
} as const;
export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];

export const AuditAction = {
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
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** PRD §6.5.2 problem/issue taxonomy — configurable vocabulary, starter set fixed. */
export const PROBLEM_TYPES = ['PEST', 'DISEASE', 'NUTRIENT_DEFICIENCY', 'WEED', 'OTHER'] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

/** PRD §6.5.2 content taxonomy used by the Crops catalog and Knowledge Base. */
export const CROP_CATEGORIES = ['FIELD', 'TREE', 'PLANTATION', 'VEGETABLE', 'OTHER'] as const;
export type CropCategory = (typeof CROP_CATEGORIES)[number];

/** PRD §7.5 Attendance status vocabulary */
export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  WEEKLY_OFF: 'WEEKLY_OFF',
  HOLIDAY: 'HOLIDAY',
  LEAVE: 'LEAVE',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AttendanceSource = {
  ESSL: 'ESSL',
  MANUAL: 'MANUAL',
} as const;
export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

/** PRD §7.7 Leave request status */
export const LeaveStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

/** PRD §7.9 Employee History type */
export const EmployeeHistoryType = {
  TRAINING: 'TRAINING',
  WARNING: 'WARNING',
  COMMENDATION: 'COMMENDATION',
  PROMOTION: 'PROMOTION',
} as const;
export type EmployeeHistoryType = (typeof EmployeeHistoryType)[keyof typeof EmployeeHistoryType];

/** PRD §7.8.4 Monthly Payroll workflow states */
export const PayrollStatus = {
  IDLE: 'IDLE',
  GENERATED: 'GENERATED',
  APPROVED_LOCKED: 'APPROVED_LOCKED',
  PUBLISHED: 'PUBLISHED',
} as const;
export type PayrollStatus = (typeof PayrollStatus)[keyof typeof PayrollStatus];
export const PayrollRunStatus = PayrollStatus;
export type PayrollRunStatus = PayrollStatus;

/** PRD §7.4.1 & §7.4.2 KPI metrics */
export const KpiMetricType = {
  CALLS_DIALED: 'CALLS_DIALED',
  CALLS_CONNECTED: 'CALLS_CONNECTED',
  LEADS_CONVERTED: 'LEADS_CONVERTED',
  CONVERSION_RATE: 'CONVERSION_RATE',
  TOTAL_REVENUE: 'TOTAL_REVENUE',
  CUSTOMER_QUALITY: 'CUSTOMER_QUALITY',
  ATTENDANCE: 'ATTENDANCE',
  CRM_DISCIPLINE: 'CRM_DISCIPLINE',
} as const;
export type KpiMetricType = (typeof KpiMetricType)[keyof typeof KpiMetricType];

/** PRD §9 Notification event types */
export const NotificationType = {
  FOLLOW_UP_REMINDER: 'FOLLOW_UP_REMINDER',
  PRODUCT_DETAILS: 'PRODUCT_DETAILS',
  ATTENDANCE_STATUS: 'ATTENDANCE_STATUS',
  LEAVE_STATUS: 'LEAVE_STATUS',
  PAYROLL_STATUS: 'PAYROLL_STATUS',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];


