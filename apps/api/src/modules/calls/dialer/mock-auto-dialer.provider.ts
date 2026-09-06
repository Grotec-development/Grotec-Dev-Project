import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallDisconnectReason, CallStatus } from '@grotec/shared';
import type {
  AutoDialerProvider,
  CallStatusSnapshot,
  PlaceCallInput,
  PlaceCallResult,
} from './auto-dialer.types';

export interface MockDialerConfig {
  providerId?: string;
  /** DIALING → RINGING latency (default 4000ms). */
  ringingMs?: number;
  /** RINGING → CONNECTED / NOT_ANSWERED latency (default 800ms). */
  connectDelayMs?: number;
  /** Probability (0..1) that a simulated call connects (default 1 = always). */
  answerRate?: number;
}

interface SimulatedCall {
  providerCallId: string;
  status: CallStatus;
  connectedAt: Date | null;
  endedAt: Date | null;
  disconnectReason: string | null;
  timers: NodeJS.Timeout[];
  ended: boolean;
}

/**
 * Development auto-dialer: simulates the provider state machine in memory.
 * DIALING → RINGING → CONNECTED (stays until endCall) or NOT_ANSWERED,
 * selected by `answerRate`. Timings/behaviour are config-driven (env) so the
 * same tests can be fast and deterministic. Swapped for a real vendor adapter
 * without touching CRM business logic.
 */
@Injectable()
export class MockAutoDialerProvider implements AutoDialerProvider {
  readonly id: string;
  private readonly ringingMs: number;
  private readonly connectDelayMs: number;
  private readonly answerRate: number;
  private readonly calls = new Map<string, SimulatedCall>();

  constructor(config: MockDialerConfig = {}) {
    this.id = config.providerId ?? 'mock';
    this.ringingMs = config.ringingMs ?? 4000;
    this.connectDelayMs = config.connectDelayMs ?? 800;
    this.answerRate = Math.min(1, Math.max(0, config.answerRate ?? 1));
  }

  placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    const providerCallId = `mock_${randomUUID()}`;
    const call: SimulatedCall = {
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

  getStatus(providerCallId: string): Promise<CallStatusSnapshot | null> {
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

  endCall(providerCallId: string): Promise<CallStatusSnapshot | null> {
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
    if (!call || call.ended) return Promise.resolve(call ? this.snapshot(call) : null);
    call.ended = true;
    for (const timer of call.timers) clearTimeout(timer);
    call.timers = [];
    call.status = CallStatus.ENDED;
    call.endedAt = new Date();
    call.disconnectReason = CallDisconnectReason.AGENT_ENDED;
    return Promise.resolve(this.snapshot(call));
  }

  handleWebhook(payload: unknown): Promise<CallStatusSnapshot | null> {
    const body = (payload ?? {}) as { providerCallId?: unknown; status?: unknown };
    if (typeof body.providerCallId !== 'string') return Promise.resolve(null);
    const call = this.calls.get(body.providerCallId);
    if (!call || typeof body.status !== 'string') return Promise.resolve(null);
    const status = body.status.toUpperCase() as CallStatus;
    if (Object.values(CallStatus).includes(status)) {
      this.applyExternal(call, status);
    }
    return Promise.resolve(this.snapshot(call));
  }

  private resolveRinging(call: SimulatedCall): void {
    if (call.ended) return;
    if (Math.random() < this.answerRate) {
      call.status = CallStatus.CONNECTED;
      call.connectedAt = new Date();
    } else {
      call.ended = true;
      call.status = CallStatus.NOT_ANSWERED;
      call.endedAt = new Date();
      call.disconnectReason = CallDisconnectReason.NOT_ANSWERED;
    }
  }

  private apply(call: SimulatedCall, status: CallStatus): void {
    if (call.ended) return;
    if (call.status === CallStatus.CONNECTED && status === CallStatus.RINGING) return;
    call.status = status;
  }

  /** Applies an externally-pushed status (webhook), mirroring end/settle semantics. */
  private applyExternal(call: SimulatedCall, status: CallStatus): void {
    if (call.ended) return;
    call.status = status;
    if (status === CallStatus.CONNECTED) {
      for (const timer of call.timers) clearTimeout(timer);
      call.timers = [];
      if (!call.connectedAt) {
        call.connectedAt = new Date();
      }
    }
    if (status === CallStatus.ENDED || status === CallStatus.NOT_ANSWERED || status === CallStatus.FAILED) {
      call.ended = true;
      for (const timer of call.timers) clearTimeout(timer);
      call.timers = [];
      if (!call.endedAt) call.endedAt = new Date();
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

  private snapshot(call: SimulatedCall): CallStatusSnapshot {
    return {
      providerCallId: call.providerCallId,
      status: call.status,
      connectedAt: call.connectedAt,
      endedAt: call.endedAt,
      disconnectReason: call.disconnectReason,
    };
  }
}