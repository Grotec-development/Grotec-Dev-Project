var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallDisconnectReason, CallStatus } from '@grotec/shared';
/**
 * Development auto-dialer: simulates the provider state machine in memory.
 * DIALING → RINGING → CONNECTED (stays until endCall) or NOT_ANSWERED,
 * selected by `answerRate`. Timings/behaviour are config-driven (env) so the
 * same tests can be fast and deterministic. Swapped for a real vendor adapter
 * without touching CRM business logic.
 */
let MockAutoDialerProvider = class MockAutoDialerProvider {
    constructor(config = {}) {
        this.calls = new Map();
        this.id = config.providerId ?? 'mock';
        this.ringingMs = config.ringingMs ?? 4000;
        this.connectDelayMs = config.connectDelayMs ?? 800;
        this.answerRate = Math.min(1, Math.max(0, config.answerRate ?? 1));
    }
    placeCall(input) {
        const providerCallId = `mock_${randomUUID()}`;
        const call = {
            providerCallId,
            status: CallStatus.DIALING,
            connectedAt: null,
            endedAt: null,
            disconnectReason: null,
            timers: [],
            ended: false,
        };
        this.calls.set(providerCallId, call);
        call.timers.push(setTimeout(() => this.apply(call, CallStatus.RINGING), this.ringingMs));
        call.timers.push(setTimeout(() => this.resolveRinging(call), this.ringingMs + this.connectDelayMs));
        return Promise.resolve({ providerCallId, status: CallStatus.DIALING });
    }
    getStatus(providerCallId) {
        let call = this.calls.get(providerCallId);
        if (!call && providerCallId.startsWith('mock_')) {
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
        return Promise.resolve(call ? this.snapshot(call) : null);
    }
    endCall(providerCallId) {
        let call = this.calls.get(providerCallId);
        if (!call && providerCallId.startsWith('mock_')) {
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
        if (!call || call.ended)
            return Promise.resolve(call ? this.snapshot(call) : null);
        call.ended = true;
        for (const timer of call.timers)
            clearTimeout(timer);
        call.timers = [];
        call.status = CallStatus.ENDED;
        call.endedAt = new Date();
        call.disconnectReason = CallDisconnectReason.AGENT_ENDED;
        return Promise.resolve(this.snapshot(call));
    }
    handleWebhook(payload) {
        const body = (payload ?? {});
        if (typeof body.providerCallId !== 'string')
            return Promise.resolve(null);
        const call = this.calls.get(body.providerCallId);
        if (!call || typeof body.status !== 'string')
            return Promise.resolve(null);
        const status = body.status.toUpperCase();
        if (Object.values(CallStatus).includes(status)) {
            this.applyExternal(call, status);
        }
        return Promise.resolve(this.snapshot(call));
    }
    resolveRinging(call) {
        if (call.ended)
            return;
        if (Math.random() < this.answerRate) {
            call.status = CallStatus.CONNECTED;
            call.connectedAt = new Date();
        }
        else {
            call.ended = true;
            call.status = CallStatus.NOT_ANSWERED;
            call.endedAt = new Date();
            call.disconnectReason = CallDisconnectReason.NOT_ANSWERED;
        }
    }
    apply(call, status) {
        if (call.ended)
            return;
        if (call.status === CallStatus.CONNECTED && status === CallStatus.RINGING)
            return;
        call.status = status;
    }
    /** Applies an externally-pushed status (webhook), mirroring end/settle semantics. */
    applyExternal(call, status) {
        if (call.ended)
            return;
        call.status = status;
        if (status === CallStatus.CONNECTED) {
            for (const timer of call.timers)
                clearTimeout(timer);
            call.timers = [];
            if (!call.connectedAt) {
                call.connectedAt = new Date();
            }
        }
        if (status === CallStatus.ENDED || status === CallStatus.NOT_ANSWERED || status === CallStatus.FAILED) {
            call.ended = true;
            for (const timer of call.timers)
                clearTimeout(timer);
            call.timers = [];
            if (!call.endedAt)
                call.endedAt = new Date();
            if (!call.disconnectReason) {
                call.disconnectReason =
                    status === CallStatus.NOT_ANSWERED
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
};
MockAutoDialerProvider = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [Object])
], MockAutoDialerProvider);
export { MockAutoDialerProvider };
