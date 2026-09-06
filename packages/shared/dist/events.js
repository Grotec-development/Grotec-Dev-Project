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
