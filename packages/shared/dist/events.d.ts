/**
 * Domain Event Contract (Checkpoint E — CORE_BUILDER).
 *
 * Stable, typed domain events emitted by the application. Each event is:
 *  - Written atomically into the outbox within the same transaction as the
 *    domain state change it describes (at-least-once delivery guarantee).
 *  - Processed idempotently by handlers (duplicate events produce no duplicate effects).
 *
 * Event naming: `<aggregate>.<past-tense-action>`
 * Aggregate: customer | lead | relationship | employee | payroll
 *
 * Payload shape is stable within a schema version. Breaking changes increment
 * the schemaVersion field.
 */
export declare const DOMAIN_EVENTS: {
    readonly CUSTOMER_CREATED: "customer.created";
    readonly CUSTOMER_UPDATED: "customer.updated";
    readonly CUSTOMER_DEACTIVATED: "customer.deactivated";
    readonly CUSTOMER_ACTIVATED: "customer.activated";
    readonly LEAD_CREATED: "lead.created";
    readonly LEAD_ASSIGNED: "lead.assigned";
    readonly LEAD_REASSIGNED: "lead.reassigned";
    readonly LEAD_UPDATED: "lead.updated";
    readonly RELATIONSHIP_ASSIGNED: "relationship.assigned";
    readonly RELATIONSHIP_REASSIGNED: "relationship.reassigned";
    readonly RELATIONSHIP_RELEASED: "relationship.released";
    readonly EMPLOYEE_DEACTIVATED: "employee.deactivated";
    readonly EMPLOYEE_ACTIVATED: "employee.activated";
    readonly PAYROLL_PUBLISHED: "payroll.published";
};
export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
/** Every domain event carries these base fields. */
export interface DomainEvent<T = unknown> {
    /** Globally unique event identifier (application-generated UUID v4). */
    eventId: string;
    /** Stable event type name. */
    eventType: DomainEventType;
    /** The aggregate this event describes (same vocabulary as eventType prefix). */
    aggregateType: string;
    /** Primary key of the aggregate instance. */
    aggregateId: string;
    /** Wall-clock time of event emission. */
    occurredAt: string;
    /** Employee who triggered this event (null for system-initiated). */
    actorId: string | null;
    /**
     * Request-scoped correlation identifier. Propagates from the incoming HTTP
     * request so all events within a causal chain share the same ID.
     */
    correlationId: string | null;
    /**
     * ID of the event that directly caused this one (e.g. lead.assigned caused
     * by relationship.assigned when a lead was converted). Enables causal chains.
     */
    causationId: string | null;
    /** Schema version of the payload — bump on breaking payload changes. */
    schemaVersion: string;
    /** Event-specific data. Schema is stable per eventType within a schemaVersion. */
    payload: T;
}
/** Payload for customer.created */
export interface CustomerCreatedPayload {
    farmerCode: string;
    fullName: string;
    phoneCount: number;
}
/** Payload for customer.updated */
export interface CustomerUpdatedPayload {
    fullName?: string;
    status?: string;
}
/** Payload for customer.deactivated / activated */
export interface CustomerStatusChangedPayload {
    status: string;
}
/** Payload for lead.created */
export interface LeadCreatedPayload {
    customerId: string;
    source: string | null;
    ownerId: string;
}
/** Payload for lead.assigned / reassigned */
export interface LeadAssignedPayload {
    ownerId: string;
    previousOwnerId: string | null;
    reason: string | null;
}
/** Payload for relationship.assigned / reassigned */
export interface RelationshipAssignedPayload {
    rmId: string;
    previousRmId: string | null;
    reason: string | null;
}
/** Payload for relationship.released */
export interface RelationshipReleasedPayload {
    previousRmId: string;
    reason: string | null;
}
/** Payload for employee.deactivated / activated */
export interface EmployeeStatusChangedPayload {
    employeeId: string;
    status: string;
}
/** Payload for payroll.published */
export interface PayrollPublishedPayload {
    runId: string;
    month: string;
    employeeCount: number;
}
