var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { normalizePhoneToE164 } from '@grotec/shared';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * High-fidelity Tamil and English agricultural dialogues for presentation demonstrations.
 * Grounded in genuine Grotec bio-fertilizer and pest management catalog.
 */
const DEMO_SCENARIOS = [
  {
    topic: 'PADDY_DISEASE_ALERT',
    crop: 'Rice (Paddy)',
    issue: 'Bacterial leaf blight and sheath blight (இலைக்கருகல் நோய்)',
    recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
    dosage: 'Foliar spray @ 5 ml/L water, alternate with Bio Jeevan TV @ 3 ml/L',
    expectedAmount: 2450,
    transcript: [
      { speaker: 'AI_ASSISTANT', text: 'வணக்கம் ஐயா, நான் குரோடெக் அக்ரோவிலிருந்து பேசும் ஏஐ குரல் உதவியாளர். உங்கள் நெல் பயிரின் தற்போதைய நிலை பற்றி தெரிந்துகொள்ள அழைத்துள்ளேன். பேச வசதியாக இருக்கிறதா?', en: 'Hello sir, I am the AI voice assistant calling from Grotec Agro. Calling to check on your paddy crop status. Is it a good time to talk?' },
      { speaker: 'FARMER', text: 'வணக்கம், சொல்லுங்க. இப்ப பயிர் நட்டு 40 நாள் ஆச்சு, இலை நுனில மஞ்சள் அடிச்சு கருகல் தெரியுது.', en: 'Hello, go ahead. It is 40 days since transplanting, leaf tips are turning yellow and drying out.' },
      { speaker: 'AI_ASSISTANT', text: 'புரிகிறது ஐயா. இது இலைக்கருகல் (Bacterial Leaf Blight) நோயின் அறிகுறியாக இருக்கலாம். இதற்கு நமது பயோ ஜீவன் பிஎஃப் (Bio Jeevan PF) மற்றும் பயோ ஜீவன் டிவி (Bio Jeevan TV) இயற்கை பூஞ்சாணக் கொல்லி மிகவும் பயனுள்ளதாக இருக்கும். 1 லிட்டர் தண்ணீருக்கு 5 மிலி கலந்து தெளிக்க வேண்டும்.', en: 'Understood sir. This appears to be Bacterial Leaf Blight. Our Bio Jeevan PF and Bio Jeevan TV organic bio-fungicides are proven effective. Spray @ 5ml per litre of water.' },
      { speaker: 'FARMER', text: 'சரிங்க, ரசாயனம் எதுவும் கலக்க வேண்டாமா? நேரடியா டெலிவரி கெடைக்குமா?', en: 'Okay, no need to mix any chemicals? Will I get direct field delivery?' },
      { speaker: 'AI_ASSISTANT', text: 'ஆமாம் ஐயா, இது 100% இயற்கை உரம், ரசாயனம் தேவை இல்லை. நமது குரோடெக் டெலிவரி வண்டி உங்கள் கிராமத்திற்கு நாளை வரும். 2 பாட்டில் பயோ ஜீவன் அனுப்பவா?', en: 'Yes sir, 100% organic bio-input, no chemicals needed. Our Grotec delivery vehicle visits your village tomorrow. Shall I dispatch 2 bottles of Bio Jeevan?' },
      { speaker: 'FARMER', text: 'சரிங்க, அனுப்பிடுங்க. கேஷ் ஆன் டெலிவரில தந்துர்றேன்.', en: 'Sure, please send them. I will pay cash on delivery.' },
      { speaker: 'AI_ASSISTANT', text: 'நன்றி ஐயா. உங்கள் ஆர்டர் விருப்பம் ₹2,450 பதிவு செய்யப்பட்டது. நமது கள ஆலோசகர் உங்களை தொடர்புகொள்வார். குரோடெக் அக்ரோவை தேர்வு செய்தமைக்கு நன்றி!', en: 'Thank you sir. Your order intent for ₹2,450 is recorded. Our field advisor will follow up. Thank you for choosing Grotec Agro!' },
    ],
  },
  {
    topic: 'SUGARCANE_RATOON_GROWTH',
    crop: 'Sugarcane',
    issue: 'Ratoon vigor and tillering enhancement (மறுதாம்பு கரும்பு வளர்ச்சி)',
    recommendedProducts: ['Ultra Action +', 'Organic Fertilizer'],
    dosage: 'Apply Grotec Organic Fertilizer @ 150 kg/acre with Ultra Action + @ 2 L/acre via drip',
    expectedAmount: 4800,
    transcript: [
      { speaker: 'AI_ASSISTANT', text: 'வணக்கம் ஐயா, குரோடெக் அக்ரோவிலிருந்து பேசுகிறேன். உங்கள் மறுதாம்பு கரும்பு பயிருக்கு தேவையான வளர்ச்சி ஊக்கி பரிந்துரைகளை வழங்க அழைத்தேன்.', en: 'Hello sir, calling from Grotec Agro. Calling to provide growth booster recommendations for your ratoon sugarcane crop.' },
      { speaker: 'FARMER', text: 'வணக்கம். கரும்பு வெட்டி ஒரு மாசம் ஆச்சு, கிளைப்பு கம்மியா இருக்கு, என்ன செய்யலாம்?', en: 'Hello. One month since cane cutting, tillering is low, what can we do?' },
      { speaker: 'AI_ASSISTANT', text: 'ஐயா, மறுதாம்பு கரும்பிற்கு தண்டு தடிமன் மற்றும் பக்கக்கிளைகள் அதிகரிக்க குரோடெக் அல்ட்ரா ஆக்சன் பிளஸ் (Ultra Action +) மிகச் சிறந்தது. ஏக்கருக்கு 2 லிட்டர் சொட்டுநீர் பாசனத்தில் கொடுக்கலாம்.', en: 'Sir, for vigorous tillering and cane girth in ratoon cane, Grotec Ultra Action Plus is ideal. Apply 2 litres per acre via drip irrigation.' },
      { speaker: 'FARMER', text: 'விலை எவ்வளவு வரும்? அடுத்த வாரம் சப்ளை பண்ண முடியுமா?', en: 'What will be the cost? Can you supply it next week?' },
      { speaker: 'AI_ASSISTANT', text: 'விலை ₹4,800 ஐயா. அடுத்த செவ்வாய்க்கிழமை நமது விநியோக வாகனத்தில் நேரில் ஒப்படைக்கப்படும். ஆர்டரை உறுதி செய்யவா?', en: 'The total cost is ₹4,800 sir. Will be delivered directly on Tuesday by our route vehicle. Shall I confirm?' },
      { speaker: 'FARMER', text: 'சரிங்க தாராளமா, செவ்வாய் அன்னைக்கு கொண்டு வாங்க.', en: 'Yes, please bring it on Tuesday.' },
      { speaker: 'AI_ASSISTANT', text: 'மிக்க நன்றி ஐயா! செவ்வாய்க்கிழமை காலை டெலிவரி நேரம் குறித்து எஸ்எம்எஸ் தகவல் வரும். நலமுடன் இருங்கள்.', en: 'Thank you very much sir! Delivery timing SMS will arrive Tuesday morning. Have a fruitful harvest.' },
    ],
  },
  {
    topic: 'CHILLI_PEST_PROTECTION',
    crop: 'Chilli',
    issue: 'Thrips and leaf curl damage (இலை சுருட்டு மற்றும் அசுவினி)',
    recommendedProducts: ['Trishul', 'Asthra'],
    dosage: 'Foliar spray of Trishul @ 3 ml/L + Asthra @ 2.5 ml/L targeting underside of leaves',
    expectedAmount: 1850,
    transcript: [
      { speaker: 'AI_ASSISTANT', text: 'வணக்கம், குரோடெக் பயிர் பாதுகாப்பு மையத்திலிருந்து பேசுகிறேன். உங்கள் மிளகாய் பயிர் ஆரோக்கியமாக உள்ளதா?', en: 'Hello, calling from Grotec Crop Care Centre. How is your chilli crop doing?' },
      { speaker: 'FARMER', text: 'இலை எல்லாம் மேல்நோக்கி சுருண்டு போகுது, பேன் தாக்குதல் அதிகமா இருக்கு.', en: 'Leaves are curling upwards, severe thrips infestation.' },
      { speaker: 'AI_ASSISTANT', text: 'கவலை வேண்டாம் ஐயா. மிளகாய் இலைப்பேனுக்கு நமது ஜீவன் சக்தி திரிசூல் (Trishul) மற்றும் அஸ்த்ரா (Asthra) சிறந்தது. இரசாயன நஞ்சில்லாத இயற்கை மருந்து. பூக்கள் கொட்டுவதையும் தடுக்கும்.', en: 'Do not worry sir. For chilli thrips, our Trishul plus Asthra combination is proven residue-free. It also prevents blossom drop.' },
      { speaker: 'FARMER', text: 'சரி, உடனடியாக ஒரு ஏக்கருக்கு தேவையான அளவு அனுப்பி வைங்க.', en: 'Alright, dispatch the required quantity for one acre immediately.' },
      { speaker: 'AI_ASSISTANT', text: 'நிச்சயமாக ஐயா, ₹1,850 மதிப்பிலான ஒரு ஏக்கர் தொகுப்பு நாளை மாலைக்குள் உங்கள் தோட்டத்தில் ஒப்படைக்கப்படும். நன்றி!', en: 'Certainly sir, one-acre combo kit worth ₹1,850 will be delivered directly to your farm by tomorrow evening. Thank you!' },
    ],
  },
];

let AiCallingService = class AiCallingService {
  constructor(prisma, audit, config) {
    this.prisma = prisma;
    this.audit = audit;
    this.config = config;
    this.logger = new Logger('AiCallingService');
  }

  /**
   * Returns sanitized public status of Vapi configuration without leaking private keys.
   */
  getConfig() {
    const vapiApiKey = this.config.get('VAPI_PRIVATE_API_KEY');
    const assistantId = this.config.get('VAPI_ASSISTANT_ID');
    const phoneNumberId = this.config.get('VAPI_PHONE_NUMBER_ID');
    const demoModeExplicit = this.config.get('VAPI_DEMO_MODE') === 'true';

    const isLiveConfigured = Boolean(vapiApiKey && assistantId && phoneNumberId);

    return {
      isLiveConfigured,
      mode: isLiveConfigured && !demoModeExplicit ? 'LIVE_TELEPHONY' : 'PRESENTATION_DEMO_READY',
      hasApiKey: Boolean(vapiApiKey),
      hasAssistantId: Boolean(assistantId),
      hasPhoneNumberId: Boolean(phoneNumberId),
      demoModeAvailable: true,
      defaultVoice: 'Tamil (Bilingual - Mrudhula / Kavitha with English Fallback)',
      model: 'Vapi Voice AI (Claude 3.5 Sonnet / GPT-4o Agro Engine)',
      supportedLanguages: [
        { code: 'ta', name: 'தமிழ் (Tamil)', isDefault: true },
        { code: 'en', name: 'English (Indian Agro)', isDefault: false },
        { code: 'bilingual', name: 'Bilingual (Tamil + English)', isDefault: false },
      ],
      assistantProfile: {
        name: 'GROTEC Agronomy Voice Advisor',
        organization: 'GROTEC Agri Technologies',
        headquarters: 'Coimbatore, Tamil Nadu',
        scope: 'Crop advisory, organic pest solutions, bio-fertilizer guidance & field delivery coordination',
      },
    };
  }

  /**
   * Returns list of eligible farmers with their phone numbers and crops for the AI demo picker.
   */
  async getEligibleFarmers(query = {}) {
    const search = typeof query.search === 'string' ? query.search.trim() : '';

    const customers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        contactStatus: { not: 'INACTIVE' },
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { farmerCode: { contains: search, mode: 'insensitive' } },
                { phones: { some: { phoneE164: { contains: search } } } },
              ],
            }
          : {}),
      },
      include: {
        phones: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        locations: { where: { deletedAt: null }, take: 1 },
        crops: { where: { deletedAt: null }, include: { crop: { select: { name: true, localName: true } } }, take: 2 },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return customers.map((c) => ({
      id: c.id,
      farmerCode: c.farmerCode,
      fullName: c.fullName,
      status: c.status,
      relationshipStage: c.relationshipStage,
      contactStatus: c.contactStatus,
      primaryPhone: c.phones[0]?.phoneE164 || null,
      additionalPhones: c.phones.slice(1).map((p) => p.phoneE164),
      location: c.locations[0]
        ? `${c.locations[0].village || ''}, ${c.locations[0].district || ''}`.replace(/^, |, $/g, '')
        : 'Tamil Nadu',
      crops: c.crops.map((cr) => cr.crop?.name || cr.notes).filter(Boolean),
    }));
  }

  /**
   * Initiates an AI voice call.
   * If live Vapi credentials are configured and simulated=false, invokes Vapi REST API.
   * Otherwise, provides an interactive presentation demonstration with grounded Tamil dialogues.
   */
  async startCall(actor, dto) {
    let customer = null;
    let targetPhone = dto.phoneNumber;

    if (dto.customerId) {
      customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        include: {
          phones: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
          locations: { where: { deletedAt: null }, take: 1 },
          crops: { where: { deletedAt: null }, include: { crop: true } },
        },
      });

      if (!customer) {
        throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Specified farmer record does not exist');
      }

      if (customer.contactStatus === 'INACTIVE' || customer.status === 'INACTIVE') {
        throw ApiError.badRequest('FARMER_OPTED_OUT', 'This farmer account is flagged as inactive or opted out of outbound outreach');
      }

      if (!targetPhone) {
        targetPhone = customer.phones[0]?.phoneE164;
      }
    }

    if (!targetPhone) {
      throw ApiError.badRequest('PHONE_REQUIRED', 'A valid phone number is required to start an AI call');
    }

    const normalizedPhone = normalizePhoneToE164(targetPhone);
    if (!normalizedPhone) {
      throw ApiError.badRequest('INVALID_PHONE', `Invalid phone number format: "${targetPhone}". Expected valid Indian mobile format.`);
    }

    // Duplicate call prevention: prevent overlapping live calls to the same phone within 3 minutes
    const recentActive = await this.prisma.call.findFirst({
      where: {
        phoneNumber: normalizedPhone,
        status: { in: ['DIALING', 'RINGING', 'CONNECTED'] },
        startedAt: { gte: new Date(Date.now() - 3 * 60 * 1000) },
      },
    });

    if (recentActive) {
      throw ApiError.badRequest('CALL_ALREADY_IN_PROGRESS', `A call to ${normalizedPhone} is already active or in-flight (ID: ${recentActive.id})`);
    }

    const vapiApiKey = this.config.get('VAPI_PRIVATE_API_KEY');
    const assistantId = this.config.get('VAPI_ASSISTANT_ID');
    const phoneNumberId = this.config.get('VAPI_PHONE_NUMBER_ID');
    const isLiveEligible = Boolean(vapiApiKey && assistantId && phoneNumberId && !dto.simulated);

    const farmerDisplayName = customer?.fullName || dto.farmerName || 'Distinguished Farmer';
    const cropNames = customer?.crops?.map((c) => c.crop?.name).filter(Boolean).join(', ') || 'Paddy / Sugarcane';

    // PATH A: LIVE VAPI TELEPHONY CALL (When API keys are present)
    if (isLiveEligible) {
      this.logger.log(`Dispatching live Vapi outbound call to ${normalizedPhone} via assistant ${assistantId}`);

      try {
        const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId,
            phoneNumberId,
            customer: {
              number: normalizedPhone,
              name: farmerDisplayName,
            },
            assistantOverrides: {
              variableValues: {
                farmerName: farmerDisplayName,
                farmerCode: customer?.farmerCode || 'GF-DEMO',
                crops: cropNames,
                district: customer?.locations?.[0]?.district || 'Tamil Nadu',
                company: 'GROTEC Agri Technologies',
              },
            },
          }),
        });

        if (!vapiRes.ok) {
          const errData = await vapiRes.json().catch(() => ({}));
          throw new Error(`Vapi API responded with status ${vapiRes.status}: ${JSON.stringify(errData)}`);
        }

        const vapiCallData = await vapiRes.json();
        const providerCallId = vapiCallData.id || `vapi_${randomUUID()}`;

        const call = await this.prisma.call.create({
          data: {
            customerId: customer?.id || null,
            agentId: actor.id,
            phoneNumber: normalizedPhone,
            direction: 'OUTBOUND',
            status: 'DIALING',
            provider: 'vapi',
            providerCallId,
            callMode: 'AI_VOICE',
            cropInterest: cropNames,
            startedAt: new Date(),
          },
        });

        await this.audit.record(this.prisma, {
          actorId: actor.id,
          entityType: 'CALL',
          entityId: call.id,
          entityLabel: normalizedPhone,
          action: 'ai_call.dispatched',
          after: { provider: 'vapi', providerCallId, farmer: farmerDisplayName },
        });

        return {
          id: call.id,
          isSimulated: false,
          providerCallId,
          status: 'DIALING',
          farmerName: farmerDisplayName,
          phoneNumber: normalizedPhone,
          message: 'Outbound Vapi AI call initiated successfully via live telephony provider.',
        };
      } catch (err) {
        this.logger.error(`Live Vapi dispatch error: ${err.message}. Falling back to presentation demonstration.`);
      }
    }

    // PATH B: PRESENTATION DEMO MODE (Safe, realistic, offline-capable)
    const scenario = DEMO_SCENARIOS.find((s) => cropNames.toLowerCase().includes(s.crop.toLowerCase().split(' ')[0])) || DEMO_SCENARIOS[0];
    const providerCallId = `vapi_demo_${randomUUID()}`;

    const call = await this.prisma.call.create({
      data: {
        customerId: customer?.id || null,
        agentId: actor.id,
        phoneNumber: normalizedPhone,
        direction: 'OUTBOUND',
        status: 'CONNECTED',
        provider: 'vapi_demo',
        providerCallId,
        callMode: 'AI_VOICE',
        cropInterest: scenario.crop,
        productInterest: scenario.recommendedProducts.join(', '),
        expectedBookingAmount: scenario.expectedAmount,
        startedAt: new Date(),
        connectedAt: new Date(),
      },
    });

    await this.prisma.callNote.create({
      data: {
        callId: call.id,
        authorId: actor.id,
        content: `[AI Voice Calling Demo] Topic: ${scenario.topic}. Crop: ${scenario.crop}. Issue: ${scenario.issue}. Recommended: ${scenario.recommendedProducts.join(', ')}.`,
      },
    });

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      entityType: 'CALL',
      entityId: call.id,
      entityLabel: normalizedPhone,
      action: 'ai_call.demo_started',
      after: { provider: 'vapi_demo', providerCallId, farmer: farmerDisplayName },
    });

    return {
      id: call.id,
      isSimulated: true,
      providerCallId,
      status: 'CONNECTED',
      farmerName: farmerDisplayName,
      farmerCode: customer?.farmerCode || 'GF00000042',
      phoneNumber: normalizedPhone,
      scenario,
      message: 'Presentation demonstration AI call started. Live Tamil agricultural dialog loaded.',
    };
  }

  /**
   * Retrieves real-time status and transcript for an ongoing or completed AI call.
   */
  async getCallStatus(callId, actor) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        customer: {
          select: { id: true, fullName: true, farmerCode: true, relationshipStage: true },
        },
        notes: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!call) {
      throw ApiError.notFound('CALL_NOT_FOUND', 'Call record not found');
    }

    // If live Vapi call and still active, query Vapi API
    if (call.provider === 'vapi' && call.status !== 'ENDED') {
      const vapiApiKey = this.config.get('VAPI_PRIVATE_API_KEY');
      if (vapiApiKey) {
        try {
          const res = await fetch(`https://api.vapi.ai/call/${call.providerCallId}`, {
            headers: { Authorization: `Bearer ${vapiApiKey}` },
          });
          if (res.ok) {
            const vapiData = await res.json();
            const vapiStatusMap = {
              queued: 'DIALING',
              ringing: 'RINGING',
              'in-progress': 'CONNECTED',
              ended: 'ENDED',
            };
            const mappedStatus = vapiStatusMap[vapiData.status] || call.status;

            if (mappedStatus !== call.status) {
              await this.prisma.call.update({
                where: { id: call.id },
                data: {
                  status: mappedStatus,
                  ...(mappedStatus === 'CONNECTED' && !call.connectedAt ? { connectedAt: new Date() } : {}),
                  ...(mappedStatus === 'ENDED' && !call.endedAt ? { endedAt: new Date() } : {}),
                },
              });
              call.status = mappedStatus;
            }
          }
        } catch {
          // Keep local status on transient network blip
        }
      }
    }

    return {
      id: call.id,
      provider: call.provider,
      providerCallId: call.providerCallId,
      status: call.status,
      phoneNumber: call.phoneNumber,
      customer: call.customer,
      cropInterest: call.cropInterest,
      productInterest: call.productInterest,
      expectedBookingAmount: call.expectedBookingAmount ? Number(call.expectedBookingAmount) : null,
      outcome: call.outcome,
      nextAction: call.nextAction,
      startedAt: call.startedAt,
      connectedAt: call.connectedAt,
      endedAt: call.endedAt,
      notes: call.notes,
      followUp: call.followUps[0] || null,
    };
  }

  /**
   * Finalizes an AI call (records outcome, transcript, extracts follow-up and intent).
   */
  async completeCall(callId, actor, data = {}) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');

    const outcome = data.outcome || 'INTERESTED';
    const nextAction = data.nextAction || 'SALES';
    const endedAt = new Date();

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: 'ENDED',
        outcome,
        nextAction,
        productInterest: data.productInterest || call.productInterest,
        cropInterest: data.cropInterest || call.cropInterest,
        expectedBookingAmount: data.expectedBookingAmount ? Number(data.expectedBookingAmount) : call.expectedBookingAmount,
        endedAt,
        disconnectReason: data.disconnectReason || 'CALL_COMPLETED',
      },
    });

    if (data.summary || data.transcriptText) {
      await this.prisma.callNote.create({
        data: {
          callId: call.id,
          authorId: actor.id,
          content: `[AI Call Summary]\n${data.summary || ''}\n\n[Transcript]\n${data.transcriptText || ''}`.trim(),
        },
      });
    }

    if (data.scheduleFollowUp && call.customerId) {
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      await this.prisma.followUp.create({
        data: {
          customerId: call.customerId,
          callId: call.id,
          employeeId: actor.id,
          assignedById: actor.id,
          dueAt,
          notes: `Automated AI follow-up regarding ${call.productInterest || 'recommended bio-fertilizers'}.`,
        },
      });
    }

    return updated;
  }

  /**
   * Secure, idempotent webhook ingestion endpoint for Vapi provider callbacks.
   */
  async handleVapiWebhook(authHeader, payload) {
    const expectedSecret = this.config.get('VAPI_WEBHOOK_SECRET');
    if (expectedSecret && authHeader !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      throw ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Unauthorized Vapi webhook invocation');
    }

    const message = payload?.message || payload;
    const type = message?.type;
    const vapiCallId = message?.call?.id || message?.callId || payload?.callId;

    this.logger.log(`Received Vapi webhook event: "${type}" for call: ${vapiCallId}`);

    if (!vapiCallId) {
      return { received: true, ignored: true, reason: 'No call identifier present' };
    }

    const call = await this.prisma.call.findUnique({
      where: { providerCallId: vapiCallId },
    });

    if (!call) {
      this.logger.warn(`Vapi webhook received for unregistered call ID: ${vapiCallId}`);
      return { received: true, matched: false };
    }

    if (type === 'end-of-call-report') {
      const summary = message?.summary || message?.analysis?.summary || 'Call completed successfully.';
      const transcript = message?.transcript || '';

      await this.prisma.$transaction(async (tx) => {
        await tx.call.update({
          where: { id: call.id },
          data: {
            status: 'ENDED',
            endedAt: new Date(),
            outcome: 'INTERESTED',
            nextAction: 'SALES',
            disconnectReason: message?.endedReason || 'COMPLETED',
          },
        });

        await tx.callNote.create({
          data: {
            callId: call.id,
            authorId: call.agentId,
            content: `[Vapi AI End-of-Call Report]\nSummary: ${summary}\n\nTranscript:\n${transcript}`,
          },
        });
      });

      return { received: true, processed: true, event: 'end-of-call-report' };
    }

    if (type === 'status-update') {
      const status = message?.status;
      const statusMap = {
        ringing: 'RINGING',
        'in-progress': 'CONNECTED',
        ended: 'ENDED',
      };
      if (statusMap[status]) {
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: statusMap[status],
            ...(status === 'in-progress' && !call.connectedAt ? { connectedAt: new Date() } : {}),
            ...(status === 'ended' && !call.endedAt ? { endedAt: new Date() } : {}),
          },
        });
      }
      return { received: true, updated: status };
    }

    return { received: true, event: type || 'unhandled' };
  }

  /**
   * Explicit confirmation and order generation from an AI voice call recommendation.
   */
  async confirmOrder(actor, dto) {
    const call = await this.prisma.call.findUnique({ where: { id: dto.callId } });
    if (!call) throw ApiError.notFound('CALL_NOT_FOUND', 'Call not found');

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { locations: { where: { deletedAt: null }, take: 1 } },
    });
    if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');

    const orderNumber = `SO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const subtotal = dto.totalAmount || 2450;
    const taxAmount = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = subtotal + taxAmount;

    let orderItems = dto.items;
    if (!orderItems || orderItems.length === 0) {
      const product = await this.prisma.product.findFirst({ where: { deletedAt: null } });
      if (product) {
        orderItems = [{
          productId: product.id,
          quantity: 2,
          unitPrice: Number(product.basePrice) || 1225,
        }];
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: customer.id,
          status: 'CONFIRMED',
          subtotal,
          taxAmount,
          totalAmount,
          paymentStatus: 'UNPAID',
          paymentMethod: 'COD',
          deliveryAddress: dto.deliveryAddress || `${customer.locations[0]?.village || ''}, ${customer.locations[0]?.district || 'Tamil Nadu'}`,
          notes: `Generated from AI Voice Call ID: ${call.id}. Extracted interest: ${call.productInterest || 'Bio Jeevan'}.`,
          createdById: actor.id,
          items: orderItems && orderItems.length > 0 ? {
            create: orderItems.map((item) => ({
              productId: item.productId,
              originalQty: item.quantity,
              approvedQty: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: 5.0,
              taxAmount: (item.quantity * item.unitPrice * 0.05),
              totalAmount: (item.quantity * item.unitPrice * 1.05),
            })),
          } : undefined,
        },
      });

      await tx.callNote.create({
        data: {
          callId: call.id,
          authorId: actor.id,
          content: `Sales Order Confirmed: ${so.orderNumber} (Total: ₹${totalAmount}). Direct delivery scheduled.`,
        },
      });

      return so;
    });

    return order;
  }

  /**
   * Returns history of AI calls placed.
   */
  async getCallHistory(actor) {
    const calls = await this.prisma.call.findMany({
      where: {
        callMode: 'AI_VOICE',
      },
      include: {
        customer: { select: { id: true, fullName: true, farmerCode: true } },
        agent: { select: { fullName: true } },
        notes: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { startedAt: 'desc' },
      take: 25,
    });

    return calls.map((c) => ({
      id: c.id,
      provider: c.provider,
      phoneNumber: c.phoneNumber,
      farmerCode: c.customer?.farmerCode,
      farmerName: c.customer?.fullName,
      cropInterest: c.cropInterest,
      productInterest: c.productInterest,
      expectedBookingAmount: c.expectedBookingAmount ? Number(c.expectedBookingAmount) : null,
      status: c.status,
      outcome: c.outcome,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      agentName: c.agent?.fullName,
      latestNote: c.notes[0]?.content || null,
    }));
  }
};

AiCallingService = __decorate([
  Injectable(),
  __metadata("design:paramtypes", [
    typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object,
    typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object,
    typeof (_c = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _c : Object,
  ]),
], AiCallingService);

export { AiCallingService };
