/**
 * BUG-009: Centralized polling intervals to prevent network flood and excessive CORS preflights.
 * - Live operational dashboards: 30s
 * - List screens (Leads, Customers, Orders, Dispatch): 45s
 * - Heavy reports / analytics: 60s
 * - Operational real-time agents (In-call dialer, Driver GPS/status): 8s
 */

export const POLL_INTERVAL_OPERATIONAL = 8_000;
export const POLL_INTERVAL_LIVE = 30_000;
export const POLL_INTERVAL_LISTS = 45_000;
export const POLL_INTERVAL_REPORTS = 60_000;
