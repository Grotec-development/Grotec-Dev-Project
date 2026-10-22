import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiCallingService } from './ai-calling.service';

describe('AiCallingService (Vapi AI Voice Calling Integration)', () => {
  let service;
  let mockPrisma;
  let mockAudit;
  let mockConfig;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      call: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      callNote: {
        create: vi.fn(),
      },
      followUp: {
        create: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
      },
      salesOrder: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(true),
    };

    mockConfig = {
      get: vi.fn((key) => {
        if (key === 'VAPI_WEBHOOK_SECRET') return 'test-webhook-secret';
        return undefined;
      }),
    };

    service = new AiCallingService(mockPrisma, mockAudit, mockConfig);
  });

  describe('getConfig', () => {
    it('returns sanitized public configuration without leaking private API key', () => {
      mockConfig.get = vi.fn((key) => {
        if (key === 'VAPI_PRIVATE_API_KEY') return 'sk-vapi-secret-key-12345';
        if (key === 'VAPI_ASSISTANT_ID') return 'asst_123';
        if (key === 'VAPI_PHONE_NUMBER_ID') return 'phone_123';
        return undefined;
      });

      const config = service.getConfig();
      expect(config.isLiveConfigured).toBe(true);
      expect(config.hasApiKey).toBe(true);
      expect(config.hasAssistantId).toBe(true);
      expect(config.hasPhoneNumberId).toBe(true);
      // Key must NEVER be returned in response object
      expect(config).not.toHaveProperty('apiKey');
      expect(config).not.toHaveProperty('vapiApiKey');
      expect(config.defaultVoice).toContain('Tamil');
      expect(config.supportedLanguages[0].code).toBe('ta');
    });

    it('reports PRESENTATION_DEMO_READY when Vapi keys are not provided', () => {
      const config = service.getConfig();
      expect(config.isLiveConfigured).toBe(false);
      expect(config.mode).toBe('PRESENTATION_DEMO_READY');
      expect(config.demoModeAvailable).toBe(true);
    });
  });

  describe('startCall (Safety, Consent & Dispatch)', () => {
    const actor = { id: 'agent-uuid-1', roleCode: 'AGENT' };

    it('rejects call if customer is flagged as opted-out / inactive', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        contactStatus: 'INACTIVE',
        status: 'INACTIVE',
      });

      await expect(
        service.startCall(actor, { customerId: 'cust-1', phoneNumber: '+919840014250' })
      ).rejects.toThrow('opted out');
    });

    it('rejects call if phone number format is invalid', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        contactStatus: 'ACTIVE',
        status: 'ACTIVE',
      });

      await expect(
        service.startCall(actor, { customerId: 'cust-1', phoneNumber: 'invalid-phone' })
      ).rejects.toThrow('Invalid phone number format');
    });

    it('prevents overlapping duplicate calls to the same phone within 3 minutes', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        contactStatus: 'ACTIVE',
        status: 'ACTIVE',
        phones: [{ phoneE164: '+919840014250', isPrimary: true }],
      });

      mockPrisma.call.findFirst.mockResolvedValue({
        id: 'existing-call-uuid',
        status: 'RINGING',
      });

      await expect(
        service.startCall(actor, { customerId: 'cust-1', phoneNumber: '+919840014250' })
      ).rejects.toThrow('already active');
    });

    it('initiates presentation demonstration call with authentic Tamil agricultural dialogue', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        fullName: 'Muthu N',
        farmerCode: 'GF00000024',
        contactStatus: 'ACTIVE',
        status: 'ACTIVE',
        phones: [{ phoneE164: '+919840014250', isPrimary: true }],
        crops: [{ crop: { name: 'Rice (Paddy)' } }],
      });

      mockPrisma.call.findFirst.mockResolvedValue(null);
      mockPrisma.call.create.mockResolvedValue({
        id: 'call-uuid-1',
        providerCallId: 'vapi_demo_mock',
        status: 'CONNECTED',
      });

      const res = await service.startCall(actor, {
        customerId: 'cust-1',
        phoneNumber: '+919840014250',
        simulated: true,
      });

      expect(res.isSimulated).toBe(true);
      expect(res.status).toBe('CONNECTED');
      expect(res.scenario.crop).toContain('Rice');
      expect(res.scenario.transcript.length).toBeGreaterThan(3);
      expect(res.scenario.transcript[0].text).toContain('வணக்கம்');
      expect(mockPrisma.call.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'vapi_demo',
            callMode: 'AI_VOICE',
            cropInterest: expect.stringContaining('Rice'),
          }),
        })
      );
    });
  });

  describe('handleVapiWebhook (Security & Ingestion)', () => {
    it('rejects unauthorized webhooks when secret does not match', async () => {
      await expect(
        service.handleVapiWebhook('wrong-secret', { type: 'status-update' })
      ).rejects.toThrow('Unauthorized');
    });

    it('updates call status on valid status-update webhook', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({
        id: 'call-1',
        providerCallId: 'vapi_call_100',
        status: 'DIALING',
      });

      const res = await service.handleVapiWebhook('test-webhook-secret', {
        message: {
          type: 'status-update',
          call: { id: 'vapi_call_100' },
          status: 'in-progress',
        },
      });

      expect(res.received).toBe(true);
      expect(res.updated).toBe('in-progress');
      expect(mockPrisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-1' },
          data: expect.objectContaining({ status: 'CONNECTED' }),
        })
      );
    });

    it('saves structured summary and transcript on end-of-call-report webhook', async () => {
      mockPrisma.call.findUnique.mockResolvedValue({
        id: 'call-1',
        agentId: 'agent-1',
        providerCallId: 'vapi_call_100',
      });

      const res = await service.handleVapiWebhook('test-webhook-secret', {
        message: {
          type: 'end-of-call-report',
          call: { id: 'vapi_call_100' },
          summary: 'Farmer interested in 2 bottles of Bio Jeevan PF for bacterial leaf blight.',
          transcript: 'AI: Hello... Farmer: Yes please send.',
          endedReason: 'customer-ended-call',
        },
      });

      expect(res.received).toBe(true);
      expect(res.processed).toBe(true);
      expect(mockPrisma.call.update).toHaveBeenCalled();
      expect(mockPrisma.callNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callId: 'call-1',
            body: expect.stringContaining('Bio Jeevan PF'),
          }),
        })
      );
    });
  });

  describe('confirmOrder (Explicit Confirmation)', () => {
    it('creates confirmed sales order only upon explicit user action', async () => {
      const actor = { id: 'agent-1' };
      mockPrisma.call.findUnique.mockResolvedValue({
        id: 'call-1',
        productInterest: 'Bio Jeevan PF',
      });
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        locations: [{ village: 'Sulur', district: 'Coimbatore' }],
      });
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        basePrice: 1225,
      });
      mockPrisma.salesOrder.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'SO-202610-9999',
        totalAmount: 2572.5,
      });

      const order = await service.confirmOrder(actor, {
        callId: 'call-1',
        customerId: 'cust-1',
        totalAmount: 2450,
      });

      expect(order).toBeDefined();
      expect(mockPrisma.salesOrder.create).toHaveBeenCalled();
      expect(mockPrisma.callNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callId: 'call-1',
            body: expect.stringContaining('Sales Order Confirmed'),
          }),
        })
      );
    });
  });
});
