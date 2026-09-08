export namespace DOMAIN_EVENTS {
    let CUSTOMER_CREATED: string;
    let CUSTOMER_UPDATED: string;
    let CUSTOMER_DEACTIVATED: string;
    let CUSTOMER_ACTIVATED: string;
    let LEAD_CREATED: string;
    let LEAD_ASSIGNED: string;
    let LEAD_REASSIGNED: string;
    let LEAD_UPDATED: string;
    let RELATIONSHIP_ASSIGNED: string;
    let RELATIONSHIP_REASSIGNED: string;
    let RELATIONSHIP_RELEASED: string;
    let EMPLOYEE_DEACTIVATED: string;
    let EMPLOYEE_ACTIVATED: string;
    let PAYROLL_PUBLISHED: string;
}
/**
 * Every domain event carries these base fields.
 */
export type DomainEvent = {
    /**
     * - Globally unique event identifier (application-generated UUID v4).
     */
    eventId: string;
    /**
     * - Stable event type name (one of DOMAIN_EVENTS' values).
     */
    eventType: string;
    /**
     * - The aggregate this event describes (same vocabulary as eventType prefix).
     */
    aggregateType: string;
    /**
     * - Primary key of the aggregate instance.
     */
    aggregateId: string;
    /**
     * - Wall-clock time of event emission (ISO-8601).
     */
    occurredAt: string;
    /**
     * - Employee who triggered this event (null for system-initiated).
     */
    actorId: string | null;
    /**
     * - Request-scoped correlation identifier; propagates from the
     * incoming HTTP request so all events within a causal chain share the same ID.
     */
    correlationId: string | null;
    /**
     * - ID of the event that directly caused this one (e.g. lead.assigned
     * caused by relationship.assigned when a lead was converted). Enables causal chains.
     */
    causationId: string | null;
    /**
     * - Schema version of the payload — bump on breaking payload changes.
     */
    schemaVersion: string;
    /**
     * - Event-specific data. Schema is stable per eventType within a schemaVersion.
     */
    payload: any;
};
/**
 * Payload for customer.created
 */
export type CustomerCreatedPayload = {
    farmerCode: string;
    fullName: string;
    phoneCount: number;
};
/**
 * Payload for customer.updated
 */
export type CustomerUpdatedPayload = {
    fullName?: string;
    status?: string;
};
/**
 * Payload for customer.deactivated / activated
 */
export type CustomerStatusChangedPayload = {
    status: string;
};
/**
 * Payload for lead.created
 */
export type LeadCreatedPayload = {
    customerId: string;
    source: string | null;
    ownerId: string;
};
/**
 * Payload for lead.assigned / reassigned
 */
export type LeadAssignedPayload = {
    ownerId: string;
    previousOwnerId: string | null;
    reason: string | null;
};
/**
 * Payload for relationship.assigned / reassigned
 */
export type RelationshipAssignedPayload = {
    rmId: string;
    previousRmId: string | null;
    reason: string | null;
};
/**
 * Payload for relationship.released
 */
export type RelationshipReleasedPayload = {
    previousRmId: string;
    reason: string | null;
};
/**
 * Payload for employee.deactivated / activated
 */
export type EmployeeStatusChangedPayload = {
    employeeId: string;
    status: string;
};
/**
 * Payload for payroll.published
 */
export type PayrollPublishedPayload = {
    runId: string;
    month: string;
    employeeCount: number;
};
