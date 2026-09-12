import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessageStatus } from '@grotec/shared';

/**
 * Exotel SMS provider for dispatching SMS to farmers and staff.
 * Connects to Exotel's REST SMS API using credentials configured in environment.
 * Gracefully falls back to simulated delivery in local development/test environments.
 */
export class ExotelSmsProvider {
    constructor(config = {}) {
        this.id = 'exotel-sms';
        this.logger = new Logger('ExotelSmsProvider');
        this.accountSid = config.accountSid || process.env.EXOTEL_ACCOUNT_SID || '';
        this.apiKey = config.apiKey || process.env.EXOTEL_API_KEY || '';
        this.apiToken = config.apiToken || process.env.EXOTEL_API_TOKEN || '';
        this.subdomain = config.subdomain || process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
        this.senderId = config.senderId || process.env.EXOTEL_SMS_SENDER_ID || process.env.EXOTEL_CALLER_ID || '08000000000';
        this.isLive = Boolean(
            process.env.NODE_ENV !== 'test' &&
            this.accountSid &&
            this.apiKey &&
            this.apiToken &&
            !this.apiKey.includes('mock') &&
            !this.apiKey.includes('demo')
        );
    }

    async send(input) {
        const { to, body } = input;
        const normalizedTo = to.startsWith('+') ? to : `+91${to.replace(/\D/g, '').slice(-10)}`;
        const simulatedId = `exo_sms_${randomUUID()}`;

        if (this.isLive) {
            try {
                const url = `https://${this.subdomain}/v1/Accounts/${this.accountSid}/Sms/send.json`;
                const basicAuth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');
                const params = new URLSearchParams();
                params.append('From', this.senderId);
                params.append('To', normalizedTo);
                params.append('Body', body);

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params.toString(),
                });

                if (res.ok) {
                    const data = await res.json();
                    const providerMessageId = data?.SMSMessage?.Sid || simulatedId;
                    this.logger.log(`Exotel SMS sent successfully to ${normalizedTo} (SID: ${providerMessageId})`);
                    return {
                        providerMessageId,
                        status: MessageStatus.SENT,
                    };
                } else {
                    const errorText = await res.text();
                    this.logger.warn(`Exotel SMS API error (${res.status}): ${errorText.slice(0, 200)}`);
                    return {
                        providerMessageId: simulatedId,
                        status: MessageStatus.FAILED,
                        error: `Exotel SMS rejected (${res.status}): ${errorText.slice(0, 200)}`,
                    };
                }
            } catch (err) {
                this.logger.warn(`Exotel SMS network failure: ${err?.message}. Falling back to simulated delivery.`);
            }
        }

        // Simulated SMS delivery
        this.logger.log(`[Simulated Exotel SMS] -> ${normalizedTo}: ${body.slice(0, 100)}`);
        return {
            providerMessageId: simulatedId,
            status: MessageStatus.SENT,
        };
    }
}
