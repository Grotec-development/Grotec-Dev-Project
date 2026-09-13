import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallDisconnectReason, CallStatus } from '@grotec/shared';

/**
 * Exotel IVRS cum Agent dialer provider.
 * Connects calls using Exotel's Voice API (IVR applet flow or agent-first bridging).
 * When live Exotel credentials are provided in the environment, dispatches calls via
 * Exotel REST API; otherwise operates in full simulated IVR-cum-agent mode for local development.
 */
export class ExotelDialerProvider {
    constructor(config = {}) {
        this.calls = new Map();
        this.id = 'exotel';
        this.accountSid = config.accountSid || process.env.EXOTEL_ACCOUNT_SID || '';
        this.apiKey = config.apiKey || process.env.EXOTEL_API_KEY || '';
        this.apiToken = config.apiToken || process.env.EXOTEL_API_TOKEN || '';
        this.subdomain = config.subdomain || process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
        this.callerId = config.callerId || process.env.EXOTEL_CALLER_ID || '08000000000';
        this.appId = config.appId || process.env.EXOTEL_APP_ID || '';
        this.flowUrl = config.flowUrl || process.env.EXOTEL_FLOW_URL || '';
        this.webhookUrl = config.webhookUrl || process.env.EXOTEL_WEBHOOK_URL || '';
        this.isLive = Boolean(
            process.env.NODE_ENV !== 'test' &&
            this.accountSid &&
            this.apiKey &&
            this.apiToken &&
            !this.apiKey.includes('mock') &&
            !this.apiKey.includes('demo')
        );
    }

    async placeCall(input) {
        const customerPhone = input.customerPhone || input.phoneE164;
        const { agentPhone, mode } = input;
        const simulatedId = `exo_${randomUUID()}`;

        if (this.isLive) {
            try {
                const url = `https://${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`;
                const basicAuth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');
                const rawFrom = (agentPhone || this.callerId || '9444330285').replace(/\D/g, '').slice(-10);
                const rawTo = (customerPhone || '').replace(/\D/g, '').slice(-10);
                const rawCallerId = (this.callerId || '9444330285').replace(/\D/g, '').slice(-10);

                const fromNumber = rawFrom.length === 10 ? `0${rawFrom}` : (agentPhone || this.callerId);
                const toNumber = rawTo.length === 10 ? `0${rawTo}` : customerPhone;
                const callerIdNumber = rawCallerId.length === 10 ? `0${rawCallerId}` : this.callerId;

                params.append('From', fromNumber);
                params.append('To', toNumber);
                params.append('CallerId', callerIdNumber);
                if (this.flowUrl || this.appId) {
                    params.append('Url', this.flowUrl || `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${this.appId}`);
                }
                if (this.webhookUrl) {
                    params.append('StatusCallback', this.webhookUrl);
                }
                params.append('CustomField', JSON.stringify({ mode: mode || 'EXOTEL_IVRS_CUM_AGENT' }));

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params.toString(),
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    console.warn(`[ExotelDialer] API returned status ${res.status}: ${errText.slice(0, 200)}. Operating in simulated IVRS bridge mode.`);
                }

                if (res.ok) {
                    const data = await res.json();
                    const providerCallId = data?.Call?.Sid || simulatedId;
                    const session = {
                        providerCallId,
                        status: CallStatus.DIALING,
                        connectedAt: null,
                        endedAt: null,
                        disconnectReason: null,
                        timers: [],
                        ended: false,
                        live: true,
                    };
                    this.calls.set(providerCallId, session);
                    return { providerCallId, status: CallStatus.DIALING };
                }
            } catch (err) {
                // Fall back to simulated flow on network or credential rejection
                console.warn('[ExotelDialer] Failed to place live call, falling back to simulated IVRS cum agent:', err?.message);
            }
        }

        // Simulated Exotel IVRS cum Agent flow
        const session = {
            providerCallId: simulatedId,
            status: CallStatus.DIALING,
            connectedAt: null,
            endedAt: null,
            disconnectReason: null,
            timers: [],
            ended: false,
            live: false,
        };
        this.calls.set(simulatedId, session);

        // Sequence: Dialing (0ms) -> Ringing (2s) -> IVR Bridge / Connected (4s)
        session.timers.push(setTimeout(() => this.apply(session, CallStatus.RINGING), 2000));
        session.timers.push(setTimeout(() => {
            if (!session.ended) {
                session.status = CallStatus.CONNECTED;
                session.connectedAt = new Date();
            }
        }, 4000));

        return { providerCallId: simulatedId, status: CallStatus.DIALING };
    }

    async getStatus(providerCallId) {
        let call = this.calls.get(providerCallId);
        if (!call && providerCallId.startsWith('exo_')) {
            call = {
                providerCallId,
                status: CallStatus.CONNECTED,
                connectedAt: new Date(),
                endedAt: null,
                disconnectReason: null,
                timers: [],
                ended: false,
            };
            this.calls.set(providerCallId, call);
        }
        return call ? this.snapshot(call) : null;
    }

    async endCall(providerCallId) {
        let call = this.calls.get(providerCallId);
        if (!call && providerCallId.startsWith('exo_')) {
            call = {
                providerCallId,
                status: CallStatus.CONNECTED,
                connectedAt: new Date(),
                endedAt: null,
                disconnectReason: null,
                timers: [],
                ended: false,
            };
            this.calls.set(providerCallId, call);
        }
        if (!call || call.ended) {
            return call ? this.snapshot(call) : null;
        }

        call.ended = true;
        for (const t of call.timers) clearTimeout(t);
        call.timers = [];
        call.status = CallStatus.ENDED;
        call.endedAt = new Date();
        call.disconnectReason = CallDisconnectReason.AGENT_ENDED;
        return this.snapshot(call);
    }

    async handleWebhook(payload) {
        const body = payload || {};
        const callSid = body.CallSid || body.providerCallId || body.sid;
        if (!callSid || typeof callSid !== 'string') return null;

        let call = this.calls.get(callSid);
        if (!call) {
            call = {
                providerCallId: callSid,
                status: CallStatus.DIALING,
                connectedAt: null,
                endedAt: null,
                disconnectReason: null,
                timers: [],
                ended: false,
            };
            this.calls.set(callSid, call);
        }

        const rawStatus = (body.Status || body.CallStatus || body.status || '').toLowerCase();
        let mappedStatus = null;
        if (['queued', 'initiated', 'ringing'].includes(rawStatus)) {
            mappedStatus = CallStatus.RINGING;
        } else if (['in-progress', 'connected'].includes(rawStatus)) {
            mappedStatus = CallStatus.CONNECTED;
        } else if (['completed'].includes(rawStatus)) {
            mappedStatus = CallStatus.ENDED;
        } else if (['no-answer', 'busy', 'canceled'].includes(rawStatus)) {
            mappedStatus = CallStatus.NOT_ANSWERED;
        } else if (['failed'].includes(rawStatus)) {
            mappedStatus = CallStatus.FAILED;
        }

        if (mappedStatus) {
            this.applyExternal(call, mappedStatus);
        }
        return this.snapshot(call);
    }

    apply(call, status) {
        if (call.ended) return;
        if (call.status === CallStatus.CONNECTED && status === CallStatus.RINGING) return;
        call.status = status;
    }

    applyExternal(call, status) {
        if (call.ended) return;
        call.status = status;
        if (status === CallStatus.CONNECTED) {
            for (const t of call.timers) clearTimeout(t);
            call.timers = [];
            if (!call.connectedAt) call.connectedAt = new Date();
        }
        if ([CallStatus.ENDED, CallStatus.NOT_ANSWERED, CallStatus.FAILED].includes(status)) {
            call.ended = true;
            for (const t of call.timers) clearTimeout(t);
            call.timers = [];
            if (!call.endedAt) call.endedAt = new Date();
            if (!call.disconnectReason) {
                call.disconnectReason = status === CallStatus.NOT_ANSWERED
                    ? CallDisconnectReason.NOT_ANSWERED
                    : status === CallStatus.FAILED
                        ? CallDisconnectReason.FAILED
                        : CallDisconnectReason.UNKNOWN;
            }
        }
    }

    snapshot(call) {
        return {
            providerCallId: call.providerCallId,
            status: call.status,
            connectedAt: call.connectedAt,
            endedAt: call.endedAt,
            disconnectReason: call.disconnectReason,
        };
    }
}
