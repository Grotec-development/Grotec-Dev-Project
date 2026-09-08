"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAIN_EVENTS = void 0;
exports.DOMAIN_EVENTS = {
    // Customer
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    CUSTOMER_DEACTIVATED: 'customer.deactivated',
    CUSTOMER_ACTIVATED: 'customer.activated',
    // Lead
    LEAD_CREATED: 'lead.created',
    LEAD_ASSIGNED: 'lead.assigned',
    LEAD_REASSIGNED: 'lead.reassigned',
    LEAD_UPDATED: 'lead.updated',
    // Relationship (RM)
    RELATIONSHIP_ASSIGNED: 'relationship.assigned',
    RELATIONSHIP_REASSIGNED: 'relationship.reassigned',
    RELATIONSHIP_RELEASED: 'relationship.released',
    // Employee
    EMPLOYEE_DEACTIVATED: 'employee.deactivated',
    EMPLOYEE_ACTIVATED: 'employee.activated',
    // Payroll
    PAYROLL_PUBLISHED: 'payroll.published',
};
/**
 * Every domain event carries these base fields.
 *
 * @typedef {Object} DomainEvent
 * @property {string} eventId - Globally unique event identifier (application-generated UUID v4).
 * @property {string} eventType - Stable event type name (one of DOMAIN_EVENTS' values).
 * @property {string} aggregateType - The aggregate this event describes (same vocabulary as eventType prefix).
 * @property {string} aggregateId - Primary key of the aggregate instance.
 * @property {string} occurredAt - Wall-clock time of event emission (ISO-8601).
 * @property {string|null} actorId - Employee who triggered this event (null for system-initiated).
 * @property {string|null} correlationId - Request-scoped correlation identifier; propagates from the
 *   incoming HTTP request so all events within a causal chain share the same ID.
 * @property {string|null} causationId - ID of the event that directly caused this one (e.g. lead.assigned
 *   caused by relationship.assigned when a lead was converted). Enables causal chains.
 * @property {string} schemaVersion - Schema version of the payload — bump on breaking payload changes.
 * @property {*} payload - Event-specific data. Schema is stable per eventType within a schemaVersion.
 */
/**
 * Payload for customer.created
 * @typedef {Object} CustomerCreatedPayload
 * @property {string} farmerCode
 * @property {string} fullName
 * @property {number} phoneCount
 */
/**
 * Payload for customer.updated
 * @typedef {Object} CustomerUpdatedPayload
 * @property {string} [fullName]
 * @property {string} [status]
 */
/**
 * Payload for customer.deactivated / activated
 * @typedef {Object} CustomerStatusChangedPayload
 * @property {string} status
 */
/**
 * Payload for lead.created
 * @typedef {Object} LeadCreatedPayload
 * @property {string} customerId
 * @property {string|null} source
 * @property {string} ownerId
 */
/**
 * Payload for lead.assigned / reassigned
 * @typedef {Object} LeadAssignedPayload
 * @property {string} ownerId
 * @property {string|null} previousOwnerId
 * @property {string|null} reason
 */
/**
 * Payload for relationship.assigned / reassigned
 * @typedef {Object} RelationshipAssignedPayload
 * @property {string} rmId
 * @property {string|null} previousRmId
 * @property {string|null} reason
 */
/**
 * Payload for relationship.released
 * @typedef {Object} RelationshipReleasedPayload
 * @property {string} previousRmId
 * @property {string|null} reason
 */
/**
 * Payload for employee.deactivated / activated
 * @typedef {Object} EmployeeStatusChangedPayload
 * @property {string} employeeId
 * @property {string} status
 */
/**
 * Payload for payroll.published
 * @typedef {Object} PayrollPublishedPayload
 * @property {string} runId
 * @property {string} month
 * @property {number} employeeCount
 */
