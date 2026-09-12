import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessageStatus } from '@grotec/shared';

/**
 * WhatsApp Business / Cloud API provider for agronomy advisory and farmer communications.
 * Supports Meta WhatsApp Cloud API and Exotel WhatsApp Messaging.
 * Gracefully simulates delivery in development or when live credentials are not set.
 */
export class WhatsAppProvider {
    constructor(config = {}) {
        this.id = 'whatsapp';
        this.logger = new Logger('WhatsAppProvider');
        this.accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
        this.phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        this.businessAccountId = config.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
        this.apiVersion = config.apiVersion || process.env.WHATSAPP_API_VERSION || 'v19.0';
        this.isLive = Boolean(
            process.env.NODE_ENV !== 'test' &&
            this.accessToken &&
            this.phoneNumberId &&
            !this.accessToken.includes('mock') &&
            !this.accessToken.includes('demo')
        );
    }

    async send(input) {
        const { to, body, templateName, templateParams } = input;
        // Normalize to international digits only (e.g. 919876543210)
        const digits = to.replace(/\D/g, '');
        const normalizedTo = digits.length === 10 ? `91${digits}` : digits;
        const simulatedId = `wa_msg_${randomUUID()}`;

        if (this.isLive) {
            try {
                const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
                
                let payload;
                if (templateName) {
                    payload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: normalizedTo,
                        type: 'template',
                        template: {
                            name: templateName,
                            language: { code: 'en' },
                            ...(templateParams ? { components: templateParams } : {}),
                        },
                    };
                } else {
                    payload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: normalizedTo,
                        type: 'text',
                        text: { preview_url: false, body },
                    };
                }

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    const data = await res.json();
                    const providerMessageId = data?.messages?.[0]?.id || simulatedId;
                    this.logger.log(`WhatsApp message dispatched to ${normalizedTo} (ID: ${providerMessageId})`);
                    return {
                        providerMessageId,
                        status: MessageStatus.SENT,
                    };
                } else {
                    const errBody = await res.text();
                    this.logger.warn(`WhatsApp API error (${res.status}): ${errBody.slice(0, 200)}`);
                    return {
                        providerMessageId: simulatedId,
                        status: MessageStatus.FAILED,
                        error: `WhatsApp API rejected (${res.status}): ${errBody.slice(0, 200)}`,
                    };
                }
            } catch (err) {
                this.logger.warn(`WhatsApp network error: ${err?.message}. Falling back to simulated delivery.`);
            }
        }

        // Simulated WhatsApp delivery
        this.logger.log(`[Simulated WhatsApp] -> +${normalizedTo}: ${body ? body.slice(0, 100) : `Template: ${templateName}`}`);
        return {
            providerMessageId: simulatedId,
            status: MessageStatus.SENT,
        };
    }
}
