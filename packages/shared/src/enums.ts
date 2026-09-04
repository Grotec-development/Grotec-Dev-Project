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
  LEAD: 'LEAD',
  CALL: 'CALL',
  CALL_NOTE: 'CALL_NOTE',
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
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
