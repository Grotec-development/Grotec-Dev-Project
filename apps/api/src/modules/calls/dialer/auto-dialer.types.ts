import type { CallStatus } from '@grotec/shared';

/**
 * Internal telephony abstraction (PRD §6.3.2 — vendor TBD). CRM business logic
 * depends only on this interface; a concrete provider adapter is selected by
 * the DialerRegistry. Never import a vendor SDK into calls business logic.
 */
export interface AutoDialerProvider {
  readonly id: string;

  /** Places an outbound auto-dial call through the provider (SIM-based). */
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;

  /** Current provider-side status. Returns null when the provider knows no such call. */
  getStatus(providerCallId: string): Promise<CallStatusSnapshot | null>;

  /**
   * Optional status push (vendor webhooks). Poll-only providers (e.g. the mock)
   * implement this too so the webhook endpoint dispatches through the same seam.
   */
  handleWebhook?(payload: unknown): Promise<CallStatusSnapshot | null>;

  /** Hangs up an active call. */
  endCall(providerCallId: string): Promise<CallStatusSnapshot | null>;
}

export interface PlaceCallInput {
  phoneE164: string;
}

export interface PlaceCallResult {
  providerCallId: string;
  status: CallStatus;
}

export interface CallStatusSnapshot {
  providerCallId: string;
  status: CallStatus;
  connectedAt?: Date | null;
  endedAt?: Date | null;
  disconnectReason?: string | null;
}