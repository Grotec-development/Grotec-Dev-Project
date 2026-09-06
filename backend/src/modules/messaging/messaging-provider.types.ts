import type { MessageStatus } from '@grotec/shared';

/**
 * Internal outbound-messaging abstraction (PRD §6.3.10/§9/§12 — channel and
 * provider TBD). CRM business logic depends only on this interface; the mock
 * adapter is the default and a real SMS/WhatsApp/email adapter is registered
 * later by config. Integration failures are surfaced (never silent): a failed
 * delivery returns a failure status that the caller records.
 */
export interface MessagingProvider {
  readonly id: string;

  send(input: SendMessageInput): Promise<SendMessageResult>;
}

export interface SendMessageInput {
  to: string; // recipient phone (canonical E.164)
  body: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  status: MessageStatus; // SENT or FAILED
  error?: string;
}
