import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessageStatus } from '@grotec/shared';
import type { MessagingProvider, SendMessageInput, SendMessageResult } from './messaging-provider.types';

/**
 * Development messaging provider: delivers instantly by logging the message.
 * Replaced by a real SMS/WhatsApp/email adapter without touching business logic.
 */
@Injectable()
export class MockMessagingProvider implements MessagingProvider {
  readonly id = 'mock';
  private readonly logger = new Logger('MockMessaging');

  send(input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.log(`[mock send] -> ${input.to}: ${input.body.slice(0, 120)}`);
    return Promise.resolve({ providerMessageId: `mock_msg_${randomUUID()}`, status: MessageStatus.SENT });
  }
}
