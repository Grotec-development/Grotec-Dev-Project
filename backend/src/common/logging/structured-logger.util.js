import { Logger } from '@nestjs/common';

export const SENSITIVE_KEY_PATTERN = /^(password|password_?hash|secret|token|access_?token|refresh_?token|api_?key|authorization|x-webhook-secret|cookie|set-cookie|client_?secret|private_?key|db_?url|database_?url|test_?database_?url|direct_?url)$/i;

export const JWT_PATTERN = /ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-\.]*/g;
export const DB_URL_PATTERN = /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"']+/gi;
export const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;

/**
 * Redacts known sensitive patterns inside arbitrary string values.
 */
export function redactString(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(DB_URL_PATTERN, '[REDACTED_DB_URL]')
        .replace(JWT_PATTERN, '[REDACTED_JWT]')
        .replace(BEARER_PATTERN, 'Bearer [REDACTED]');
}

/**
 * Recursively deep-redacts sensitive keys and values in an object/array.
 * Circular reference safe.
 */
export function redactObject(data, seen = new WeakSet()) {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return redactString(data);
    if (typeof data !== 'object') return data;
    if (seen.has(data)) return '[CIRCULAR]';
    seen.add(data);

    if (Array.isArray(data)) {
        return data.map((item) => redactObject(item, seen));
    }

    const output = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            output[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            output[key] = redactObject(value, seen);
        } else if (typeof value === 'string') {
            output[key] = redactString(value);
        } else {
            output[key] = value;
        }
    }
    return output;
}

/**
 * Whitelists only safe, diagnostic fields from an inbound webhook payload.
 * Never dumps raw unparsed customer PII or unexpected vendor fields.
 */
export function extractSafeDialerPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const safe = {};
    if (typeof payload.providerCallId === 'string') safe.providerCallId = payload.providerCallId;
    if (typeof payload.status === 'string') safe.status = payload.status;
    if (typeof payload.disconnectReason === 'string') safe.disconnectReason = payload.disconnectReason;
    if (typeof payload.duration === 'number' || typeof payload.duration === 'string') safe.duration = payload.duration;
    if (typeof payload.sequence === 'number' || typeof payload.sequence === 'string') safe.sequence = payload.sequence;
    if (typeof payload.eventId === 'string') safe.eventId = payload.eventId;
    return Object.keys(safe).length > 0 ? safe : null;
}

/**
 * Formats a standardized structured webhook log record.
 */
export function formatWebhookLog({
    context = 'DialerWebhook',
    level = 'INFO',
    provider,
    eventId,
    canonicalEventId,
    correlationId,
    result,
    httpStatus,
    durationMs,
    payload,
    error,
    reason,
}) {
    const log = {
        timestamp: new Date().toISOString(),
        level,
        context,
        provider: provider ?? 'unknown',
        correlationId: correlationId ?? null,
        result,
    };

    if (eventId) log.eventId = eventId;
    if (canonicalEventId) log.canonicalEventId = canonicalEventId;
    if (httpStatus !== undefined) log.httpStatus = httpStatus;
    if (durationMs !== undefined) log.durationMs = durationMs;
    if (reason) log.reason = reason;

    if (payload) {
        log.safePayload = extractSafeDialerPayload(payload);
    }

    if (error) {
        log.error = {
            name: error.name || 'Error',
            message: redactString(error.message || String(error)),
            code: error.code || undefined,
            ...(error.status ? { status: error.status } : {}),
        };
    }

    return redactObject(log);
}

/**
 * Structured Logger utility wrapping NestJS Logger with redaction.
 */
export class WebhookStructuredLogger {
    constructor(context = 'DialerWebhook') {
        this.context = context;
        this.nestLogger = new Logger(context);
    }

    info(logData) {
        const formatted = formatWebhookLog({ ...logData, context: this.context, level: 'INFO' });
        this.nestLogger.log(JSON.stringify(formatted));
        return formatted;
    }

    warn(logData) {
        const formatted = formatWebhookLog({ ...logData, context: this.context, level: 'WARN' });
        this.nestLogger.warn(JSON.stringify(formatted));
        return formatted;
    }

    error(logData) {
        const formatted = formatWebhookLog({ ...logData, context: this.context, level: 'ERROR' });
        this.nestLogger.error(JSON.stringify(formatted));
        return formatted;
    }
}
