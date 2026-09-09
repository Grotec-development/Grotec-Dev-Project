import { describe, it, expect, vi } from 'vitest';
import {
    redactString,
    redactObject,
    extractSafeDialerPayload,
    formatWebhookLog,
    WebhookStructuredLogger,
    SENSITIVE_KEY_PATTERN,
    JWT_PATTERN,
    DB_URL_PATTERN,
} from './structured-logger.util';

describe('Structured Logger & Redaction Utility (CWE-532 & Information Disclosure Defense)', () => {
    describe('redactString', () => {
        it('redacts database connection strings (Postgres, MySQL, MongoDB, Redis)', () => {
            const raw1 = 'Connected to postgresql://postgres:SuperSecret123@db.supabase.co:5432/grotec_crm?ssl=true';
            const raw2 = 'Error connecting to mysql://root:pass_word@localhost:3306/crm';
            const raw3 = 'redis://:redis_auth_token@redis-cache:6379/0';

            expect(redactString(raw1)).toBe('Connected to [REDACTED_DB_URL]');
            expect(redactString(raw2)).toBe('Error connecting to [REDACTED_DB_URL]');
            expect(redactString(raw3)).toBe('[REDACTED_DB_URL]');
        });

        it('redacts JSON Web Tokens (JWTs)', () => {
            const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            const text = `User token is ${jwt} in session`;
            expect(redactString(text)).toBe('User token is [REDACTED_JWT] in session');
        });

        it('redacts Bearer authorization tokens', () => {
            const bearer = 'Bearer ya29.a0AfH6SMD_random_google_oauth_token_string';
            expect(redactString(bearer)).toBe('Bearer [REDACTED]');
        });

        it('returns non-string values unchanged', () => {
            expect(redactString(12345)).toBe(12345);
            expect(redactString(null)).toBe(null);
            expect(redactString(undefined)).toBe(undefined);
        });
    });

    describe('redactObject (Deep Recursive Redaction)', () => {
        it('redacts sensitive keys regardless of casing or formatting', () => {
            const input = {
                password: 'plain_password',
                PasswordHash: '$2b$10$abcdef123456',
                password_hash: '$2b$10$abcdef123456',
                secret: 'webhook_secret_key',
                token: 'sess_token_123',
                accessToken: 'access_123',
                refresh_token: 'refresh_123',
                apiKey: 'api_key_live_999',
                api_key: 'api_key_live_999',
                authorization: 'Bearer secret_token',
                'x-webhook-secret': 'dev-webhook-secret',
                cookie: 'session_id=abc; auth=xyz',
                'set-cookie': 'id=123',
                database_url: 'postgresql://usr:pwd@host:5432/db',
                normalField: 'harmless_data',
            };

            const redacted = redactObject(input);

            expect(redacted.password).toBe('[REDACTED]');
            expect(redacted.PasswordHash).toBe('[REDACTED]');
            expect(redacted.password_hash).toBe('[REDACTED]');
            expect(redacted.secret).toBe('[REDACTED]');
            expect(redacted.token).toBe('[REDACTED]');
            expect(redacted.accessToken).toBe('[REDACTED]');
            expect(redacted.refresh_token).toBe('[REDACTED]');
            expect(redacted.apiKey).toBe('[REDACTED]');
            expect(redacted.api_key).toBe('[REDACTED]');
            expect(redacted.authorization).toBe('[REDACTED]');
            expect(redacted['x-webhook-secret']).toBe('[REDACTED]');
            expect(redacted.cookie).toBe('[REDACTED]');
            expect(redacted['set-cookie']).toBe('[REDACTED]');
            expect(redacted.database_url).toBe('[REDACTED]');
            expect(redacted.normalField).toBe('harmless_data');
        });

        it('redacts sensitive values in nested arrays and sub-objects', () => {
            const input = {
                service: 'dialer',
                nested: {
                    credentials: {
                        secret: 'sub_secret',
                        dbUrl: 'postgres://admin:pwd@db:5432/grotec',
                    },
                    history: [
                        { token: 't1', note: 'safe' },
                        { connectionString: 'postgresql://db:5432/test' },
                    ],
                },
            };

            const redacted = redactObject(input);

            expect(redacted.nested.credentials.secret).toBe('[REDACTED]');
            expect(redacted.nested.credentials.dbUrl).toBe('[REDACTED]');
            expect(redacted.nested.history[0].token).toBe('[REDACTED]');
            expect(redacted.nested.history[0].note).toBe('safe');
            expect(redacted.nested.history[1].connectionString).toBe('[REDACTED_DB_URL]');
        });

        it('safely handles circular references without throwing or infinite loop', () => {
            const circular = { name: 'circular_test' };
            circular.self = circular;

            const redacted = redactObject(circular);
            expect(redacted.name).toBe('circular_test');
            expect(redacted.self).toBe('[CIRCULAR]');
        });
    });

    describe('extractSafeDialerPayload', () => {
        it('whitelists only safe diagnostic telephony fields', () => {
            const rawPayload = {
                providerCallId: 'call-uuid-1234',
                status: 'CONNECTED',
                disconnectReason: 'NORMAL_CLEARING',
                duration: 45,
                sequence: 2,
                eventId: 'evt-001',
                // Malicious or sensitive fields injected in webhook:
                customerAadhaar: '1234-5678-9012',
                farmerBankAcc: '987654321098',
                secretToken: 'shhh',
                extraVendorJunk: { foo: 'bar' },
            };

            const safe = extractSafeDialerPayload(rawPayload);

            expect(safe).toEqual({
                providerCallId: 'call-uuid-1234',
                status: 'CONNECTED',
                disconnectReason: 'NORMAL_CLEARING',
                duration: 45,
                sequence: 2,
                eventId: 'evt-001',
            });
            expect(safe.customerAadhaar).toBeUndefined();
            expect(safe.farmerBankAcc).toBeUndefined();
            expect(safe.secretToken).toBeUndefined();
            expect(safe.extraVendorJunk).toBeUndefined();
        });

        it('returns null for empty or non-object payloads', () => {
            expect(extractSafeDialerPayload(null)).toBeNull();
            expect(extractSafeDialerPayload(undefined)).toBeNull();
            expect(extractSafeDialerPayload('string')).toBeNull();
            expect(extractSafeDialerPayload({})).toBeNull();
        });
    });

    describe('formatWebhookLog', () => {
        it('formats structured log entry with required metadata', () => {
            const entry = formatWebhookLog({
                context: 'DialerWebhookController',
                level: 'INFO',
                provider: 'mock',
                eventId: 'dialer:mock:call-1:CONNECTED',
                canonicalEventId: 'ce04bdf7-f619-598a-a02b-c067330fe347',
                correlationId: 'req_12345678',
                result: 'SUCCESS',
                httpStatus: 201,
                durationMs: 25,
                payload: { providerCallId: 'call-1', status: 'CONNECTED' },
            });

            expect(entry.level).toBe('INFO');
            expect(entry.context).toBe('DialerWebhookController');
            expect(entry.provider).toBe('mock');
            expect(entry.eventId).toBe('dialer:mock:call-1:CONNECTED');
            expect(entry.canonicalEventId).toBe('ce04bdf7-f619-598a-a02b-c067330fe347');
            expect(entry.correlationId).toBe('req_12345678');
            expect(entry.result).toBe('SUCCESS');
            expect(entry.httpStatus).toBe(201);
            expect(entry.durationMs).toBe(25);
            expect(entry.safePayload).toEqual({ providerCallId: 'call-1', status: 'CONNECTED' });
            expect(entry.timestamp).toBeDefined();
        });

        it('redacts error message containing sensitive secrets', () => {
            const sensitiveError = new Error('Failed to connect to postgresql://postgres:dbpass@db.local:5432/db with key secret_token_xyz');
            const entry = formatWebhookLog({
                provider: 'mock',
                result: 'ERROR',
                error: sensitiveError,
            });

            expect(entry.error.name).toBe('Error');
            expect(entry.error.message).not.toContain('dbpass');
            expect(entry.error.message).not.toContain('postgresql://');
            expect(entry.error.message).toContain('[REDACTED_DB_URL]');
        });
    });

    describe('WebhookStructuredLogger', () => {
        it('emits serialized JSON through NestJS Logger', () => {
            const logger = new WebhookStructuredLogger('TestContext');
            const logSpy = vi.spyOn(logger.nestLogger, 'log').mockImplementation(() => {});
            const warnSpy = vi.spyOn(logger.nestLogger, 'warn').mockImplementation(() => {});
            const errorSpy = vi.spyOn(logger.nestLogger, 'error').mockImplementation(() => {});

            logger.info({ provider: 'mock', result: 'SUCCESS' });
            expect(logSpy).toHaveBeenCalledTimes(1);
            const parsedInfo = JSON.parse(logSpy.mock.calls[0][0]);
            expect(parsedInfo.level).toBe('INFO');
            expect(parsedInfo.result).toBe('SUCCESS');

            logger.warn({ provider: 'mock', result: 'AUTH_FAILED' });
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const parsedWarn = JSON.parse(warnSpy.mock.calls[0][0]);
            expect(parsedWarn.level).toBe('WARN');
            expect(parsedWarn.result).toBe('AUTH_FAILED');

            logger.error({ provider: 'mock', result: 'ERROR', error: new Error('boom') });
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const parsedError = JSON.parse(errorSpy.mock.calls[0][0]);
            expect(parsedError.level).toBe('ERROR');
            expect(parsedError.result).toBe('ERROR');
        });
    });
});
