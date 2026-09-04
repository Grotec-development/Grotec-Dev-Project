import { describe, expect, it } from 'vitest';
import { CallDisconnectReason, CallStatus } from '@grotec/shared';
import { MockAutoDialerProvider } from './mock-auto-dialer.provider';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('MockAutoDialerProvider', () => {
  it('drives dialing → ringing → connected and stays connected until ended', async () => {
    const dialer = new MockAutoDialerProvider({ ringingMs: 5, connectDelayMs: 5, answerRate: 1 });
    const placed = await dialer.placeCall({ phoneE164: '+919876500001' });
    expect(placed.status).toBe(CallStatus.DIALING);
    expect(placed.providerCallId).toMatch(/^mock_/);

    await sleep(50);
    const mid = await dialer.getStatus(placed.providerCallId);
    expect(mid?.status).toBe(CallStatus.CONNECTED);
    expect(mid?.connectedAt).toBeInstanceOf(Date);

    const ended = await dialer.endCall(placed.providerCallId);
    expect(ended?.status).toBe(CallStatus.ENDED);
    expect(ended?.disconnectReason).toBe(CallDisconnectReason.AGENT_ENDED);
    expect(ended?.endedAt).toBeInstanceOf(Date);

    // Ending twice is a no-op (idempotent).
    const again = await dialer.endCall(placed.providerCallId);
    expect(again?.status).toBe(CallStatus.ENDED);
  });

  it('ends as NOT_ANSWERED when the answer rate is zero', async () => {
    const dialer = new MockAutoDialerProvider({ ringingMs: 5, connectDelayMs: 5, answerRate: 0 });
    const placed = await dialer.placeCall({ phoneE164: '+919876500002' });
    expect(placed.status).toBe(CallStatus.DIALING);
    await sleep(60);
    const status = await dialer.getStatus(placed.providerCallId);
    expect(status?.status).toBe(CallStatus.NOT_ANSWERED);
    expect(status?.disconnectReason).toBe(CallDisconnectReason.NOT_ANSWERED);
    expect(status?.endedAt).toBeInstanceOf(Date);
  });

  it('applies webhook pushes and rejects unknown calls', async () => {
    const dialer = new MockAutoDialerProvider({ ringingMs: 5, connectDelayMs: 5, answerRate: 0 });
    const placed = await dialer.placeCall({ phoneE164: '+919876500003' });

    const snapshot = await dialer.handleWebhook({ providerCallId: placed.providerCallId, status: 'connected' });
    expect(snapshot?.status).toBe(CallStatus.CONNECTED);
    expect(snapshot?.connectedAt).toBeInstanceOf(Date);

    await expect(dialer.handleWebhook({ providerCallId: 'no-such-call', status: 'connected' })).resolves.toBeNull();
    await expect(dialer.handleWebhook({ status: 'connected' })).resolves.toBeNull();
  });

  it('ignores unknown provider calls in getStatus', async () => {
    const dialer = new MockAutoDialerProvider();
    await expect(dialer.getStatus('no-such-call')).resolves.toBeNull();
  });
});