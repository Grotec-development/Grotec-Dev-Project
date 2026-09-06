import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../../common/errors/api-error';
import { Public } from '../../common/decorators/public.decorator';
import { CallsService } from './calls.service';
import { DialerRegistry } from './dialer/dialer.registry';

/**
 * Status-push endpoint for telephony vendors (webhooks). Sits behind the same
 * AutoDialerProvider abstraction as everything else: the provider id selects
 * the adapter, which maps the vendor payload to a canonical snapshot. Guarded
 * by a shared secret (DIALER_WEBHOOK_SECRET) rather than session auth because
 * vendors cannot hold CRM sessions.
 */
@Controller('dialer')
export class DialerWebhookController {
  constructor(
    private readonly dialers: DialerRegistry,
    private readonly calls: CallsService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhooks/:provider')
  @Public()
  async webhook(
    @Param('provider') providerId: string,
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() payload: unknown,
  ) {
    const expected = this.config.get<string>('DIALER_WEBHOOK_SECRET');
    if (!expected) {
      throw new ApiError(503, 'WEBHOOKS_DISABLED', 'Webhook endpoints are not configured (DIALER_WEBHOOK_SECRET unset)');
    }
    if (!secret || secret !== expected) {
      throw ApiError.unauthorized('INVALID_WEBHOOK_SECRET', 'Invalid webhook secret');
    }
    if (!this.dialers.has(providerId)) {
      throw ApiError.notFound('PROVIDER_NOT_FOUND', `Unknown dialer provider: ${providerId}`);
    }
    const provider = this.dialers.get(providerId);
    if (!provider.handleWebhook) {
      return { received: true, ignored: true, reason: 'provider does not accept webhooks' };
    }
    const snapshot = await provider.handleWebhook(payload);
    if (!snapshot) {
      return { received: true, ignored: true, reason: 'unrecognized provider call' };
    }
    await this.calls.syncSnapshotFromWebhook(providerId, snapshot);
    return { received: true, applied: true };
  }
}