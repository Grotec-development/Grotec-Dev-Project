import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MessageStatus } from '@grotec/shared';
import { ExotelSmsProvider } from './exotel-sms.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { MessagingRegistry } from './messaging.registry';
import { MessagingService } from './messaging.service';

describe('Messaging Providers & Integration', () => {
    describe('ExotelSmsProvider', () => {
        it('dispatches SMS and returns providerMessageId with SENT status in simulation mode', async () => {
            const provider = new ExotelSmsProvider();
            const res = await provider.send({ to: '9876543210', body: 'Hello Farmer, here is your advisory.' });

            expect(res.status).toBe(MessageStatus.SENT);
            expect(res.providerMessageId).toMatch(/^exo_sms_/);
        });

        it('normalizes 10-digit Indian phone numbers to +91 format', async () => {
            const provider = new ExotelSmsProvider();
            const logSpy = vi.spyOn(provider.logger, 'log');
            await provider.send({ to: '9876543210', body: 'Order confirmed' });

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('+919876543210'));
        });
    });

    describe('WhatsAppProvider', () => {
        it('dispatches text WhatsApp message with SENT status', async () => {
            const provider = new WhatsAppProvider();
            const res = await provider.send({ to: '+919876543210', body: 'Your bio-fertilizer schedule is ready.' });

            expect(res.status).toBe(MessageStatus.SENT);
            expect(res.providerMessageId).toMatch(/^wa_msg_/);
        });

        it('supports template dispatch', async () => {
            const provider = new WhatsAppProvider();
            const logSpy = vi.spyOn(provider.logger, 'log');
            await provider.send({
                to: '9876543210',
                templateName: 'crop_advisory_v1',
                templateParams: [{ type: 'body', parameters: [{ type: 'text', text: 'Tomato' }] }],
            });

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Template: crop_advisory_v1'));
        });
    });

    describe('SmtpEmailProvider', () => {
        it('simulates transactional email delivery when in mock mode', async () => {
            const provider = new SmtpEmailProvider({ host: 'mock' });
            const res = await provider.send({
                to: 'farmer@example.com',
                subject: 'Soil Health Report',
                body: 'Your soil health analysis report is attached.',
            });

            expect(res.status).toBe(MessageStatus.SENT);
            expect(res.providerMessageId).toMatch(/^smtp_/);
        });

        it('reports not configured when host is empty', async () => {
            const provider = new SmtpEmailProvider({ host: '' });
            const status = await provider.verify();

            expect(status.configured).toBe(false);
            expect(status.connected).toBe(false);
        });
    });

    describe('MessagingRegistry', () => {
        it('registers all 4 messaging providers by default', () => {
            const config = { get: vi.fn().mockReturnValue(undefined) };
            const registry = new MessagingRegistry(config);

            expect(registry.has('mock')).toBe(true);
            expect(registry.has('exotel-sms')).toBe(true);
            expect(registry.has('whatsapp')).toBe(true);
            expect(registry.has('smtp-email')).toBe(true);
        });

        it('provides channel-specific provider getters', () => {
            const config = { get: vi.fn().mockReturnValue(undefined) };
            const registry = new MessagingRegistry(config);

            expect(registry.getSmsProvider().id).toBe('exotel-sms');
            expect(registry.getWhatsAppProvider().id).toBe('whatsapp');
            expect(registry.getEmailProvider().id).toBe('smtp-email');
        });
    });

    describe('MessagingService', () => {
        let prismaMock;
        let auditMock;
        let registry;
        let service;

        beforeEach(() => {
            prismaMock = {
                outboundMessage: {
                    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
                    findUnique: vi.fn(),
                    update: vi.fn(),
                },
                $transaction: vi.fn().mockImplementation((cb) => cb(prismaMock)),
            };
            auditMock = { record: vi.fn().mockResolvedValue(undefined) };
            const config = { get: vi.fn().mockReturnValue(undefined) };
            registry = new MessagingRegistry(config);
            service = new MessagingService(prismaMock, auditMock, registry);
        });

        it('sends SMS and returns standardized delivery snapshot', async () => {
            const actor = { id: 'agent-1' };
            const res = await service.sendSms(actor, {
                to: '+919876500001',
                body: 'Advisory: Grotec Nitro 500ml per acre',
                customerId: 'c1111111-1111-1111-1111-111111111111',
            });

            expect(res.channel).toBe('SMS');
            expect(res.to).toBe('+919876500001');
            expect(res.status).toBe(MessageStatus.SENT);
            expect(prismaMock.outboundMessage.create).toHaveBeenCalled();
            expect(auditMock.record).toHaveBeenCalled();
        });

        it('sends WhatsApp message and records in audit', async () => {
            const actor = { id: 'agent-1' };
            const res = await service.sendWhatsApp(actor, {
                to: '+919876500002',
                body: 'Recommended Organic Spray Schedule',
                customerId: 'c2222222-2222-2222-2222-222222222222',
            });

            expect(res.channel).toBe('WHATSAPP');
            expect(res.status).toBe(MessageStatus.SENT);
            expect(auditMock.record).toHaveBeenCalled();
        });

        it('sends Email and reports status', async () => {
            const actor = { id: 'agent-1' };
            const res = await service.sendEmail(actor, {
                to: 'farmer@example.com',
                subject: 'Quotation for Organic Agri-inputs',
                body: 'Dear Suresh, here is your quotation.',
            });

            expect(res.channel).toBe('EMAIL');
            expect(res.status).toBe(MessageStatus.SENT);
        });

        it('returns provider connectivity status summary', async () => {
            const status = await service.getProviderStatus();

            expect(status.sms).toBeDefined();
            expect(status.whatsapp).toBeDefined();
            expect(status.smtp).toBeDefined();
        });
    });
});
