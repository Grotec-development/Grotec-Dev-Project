var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockMessagingProvider } from './mock-messaging.provider';
import { ExotelSmsProvider } from './exotel-sms.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

/**
 * Selects and manages active messaging providers:
 * - SMS: ExotelSmsProvider (with mock fallback)
 * - WhatsApp: WhatsAppProvider (Meta Cloud / Exotel)
 * - Email: SmtpEmailProvider (Nodemailer / SMTP)
 * - Default: MockMessagingProvider
 */
let MessagingRegistry = class MessagingRegistry {
    constructor(config) {
        this.providers = new Map();
        this.defaultId = config.get('MESSAGING_PROVIDER') ?? 'exotel-sms';

        // 1. Mock provider
        this.register(new MockMessagingProvider());

        // 2. Exotel SMS provider
        this.register(new ExotelSmsProvider({
            accountSid: config.get('EXOTEL_ACCOUNT_SID'),
            apiKey: config.get('EXOTEL_API_KEY'),
            apiToken: config.get('EXOTEL_API_TOKEN'),
            subdomain: config.get('EXOTEL_SUBDOMAIN'),
            senderId: config.get('EXOTEL_SMS_SENDER_ID') || config.get('EXOTEL_CALLER_ID'),
        }));

        // 3. WhatsApp provider
        this.register(new WhatsAppProvider({
            accessToken: config.get('WHATSAPP_ACCESS_TOKEN'),
            phoneNumberId: config.get('WHATSAPP_PHONE_NUMBER_ID'),
            businessAccountId: config.get('WHATSAPP_BUSINESS_ACCOUNT_ID'),
            apiVersion: config.get('WHATSAPP_API_VERSION'),
        }));

        // 4. SMTP Email provider
        this.register(new SmtpEmailProvider({
            host: config.get('SMTP_HOST'),
            port: config.get('SMTP_PORT'),
            secure: config.get('SMTP_SECURE') === 'true',
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASS'),
            from: config.get('SMTP_FROM'),
        }));
    }

    get(id) {
        const provider = this.providers.get(id ?? this.defaultId) ?? this.providers.get(this.defaultId) ?? this.providers.get('mock');
        if (!provider) {
            throw new Error(`No messaging provider registered: ${id ?? this.defaultId}`);
        }
        return provider;
    }

    getSmsProvider() {
        return this.providers.get('exotel-sms') ?? this.get('mock');
    }

    getWhatsAppProvider() {
        return this.providers.get('whatsapp') ?? this.get('mock');
    }

    getEmailProvider() {
        return this.providers.get('smtp-email') ?? this.get('mock');
    }

    has(id) {
        return this.providers.has(id);
    }

    listIds() {
        return [...this.providers.keys()];
    }

    register(provider) {
        this.providers.set(provider.id, provider);
    }
};

MessagingRegistry = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _a : Object])
], MessagingRegistry);
export { MessagingRegistry };
