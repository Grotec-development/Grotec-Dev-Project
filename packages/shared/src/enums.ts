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
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
