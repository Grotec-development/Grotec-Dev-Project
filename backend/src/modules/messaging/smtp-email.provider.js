import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { MessageStatus } from '@grotec/shared';

/**
 * SMTP Email provider for transactional notifications, payslips, follow-up alerts,
 * and agronomy communications. Connects to standard SMTP services (Gmail, SendGrid,
 * AWS SES, Postmark, Mailgun, Brevo, or custom mail servers).
 */
export class SmtpEmailProvider {
    constructor(config = {}) {
        this.id = 'smtp-email';
        this.logger = new Logger('SmtpEmailProvider');
        this.host = config.host || process.env.SMTP_HOST || '';
        this.port = Number(config.port || process.env.SMTP_PORT || 587);
        this.secure = (config.secure !== undefined ? config.secure : process.env.SMTP_SECURE === 'true') || this.port === 465;
        this.user = config.user || process.env.SMTP_USER || '';
        this.pass = config.pass || process.env.SMTP_PASS || '';
        this.from = config.from || process.env.SMTP_FROM || process.env.MAIL_FROM || '"GROTEC FarmerOS" <notifications@grotec.local>';

        this.isLive = Boolean(
            process.env.NODE_ENV !== 'test' &&
            this.host &&
            !this.host.includes('mock') &&
            !this.host.includes('example')
        );

        if (this.isLive) {
            try {
                this.transporter = nodemailer.createTransport({
                    host: this.host,
                    port: this.port,
                    secure: this.secure,
                    auth: this.user ? { user: this.user, pass: this.pass } : undefined,
                });
            } catch (err) {
                this.logger.warn(`Failed to initialize SMTP transporter: ${err.message}`);
                this.transporter = null;
            }
        } else {
            this.transporter = null;
        }
    }

    async send(input) {
        const { to, subject, body, html, attachments } = input;
        const simulatedId = `smtp_${randomUUID()}`;

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({
                    from: this.from,
                    to,
                    subject: subject || 'Notification from GROTEC FarmerOS',
                    text: body,
                    html: html || (body ? `<p style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</p>` : undefined),
                    attachments,
                });

                this.logger.log(`SMTP Email sent to ${to} (MessageId: ${info.messageId})`);
                return {
                    providerMessageId: info.messageId || simulatedId,
                    status: MessageStatus.SENT,
                };
            } catch (err) {
                this.logger.warn(`SMTP transmission error to ${to}: ${err.message}. Falling back to simulation.`);
                return {
                    providerMessageId: simulatedId,
                    status: MessageStatus.FAILED,
                    error: `SMTP failed: ${err.message.slice(0, 300)}`,
                };
            }
        }

        // Simulated SMTP delivery
        this.logger.log(`[Simulated SMTP Email] -> ${to} | Subject: "${subject || 'Notification'}" | Body: ${(body || html || '').slice(0, 80)}`);
        return {
            providerMessageId: simulatedId,
            status: MessageStatus.SENT,
        };
    }

    async verify() {
        if (!this.transporter) {
            return {
                configured: false,
                connected: false,
                reason: 'SMTP host is not configured or in mock mode.',
            };
        }
        try {
            await this.transporter.verify();
            return {
                configured: true,
                connected: true,
                host: this.host,
                port: this.port,
                user: this.user ? `${this.user.slice(0, 3)}***` : undefined,
            };
        } catch (err) {
            return {
                configured: true,
                connected: false,
                error: err.message,
            };
        }
    }
}
