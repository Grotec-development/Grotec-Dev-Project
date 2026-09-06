import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MessagingProvider } from './messaging-provider.types';
import { MockMessagingProvider } from './mock-messaging.provider';

/**
 * Selects the active MessagingProvider (config MESSAGING_PROVIDER, default
 * `mock`). A production vendor adapter is registered here when selected —
 * business logic never names a vendor directly.
 */
@Injectable()
export class MessagingRegistry {
  private readonly providers = new Map<string, MessagingProvider>();
  private readonly defaultId: string;

  constructor(config: ConfigService) {
    this.defaultId = config.get<string>('MESSAGING_PROVIDER') ?? 'mock';
    this.register(new MockMessagingProvider());
  }

  get(id?: string | null): MessagingProvider {
    const provider = this.providers.get(id ?? this.defaultId) ?? this.providers.get(this.defaultId);
    if (!provider) throw new Error(`No messaging provider registered: ${id ?? this.defaultId}`);
    return provider;
  }

  private register(provider: MessagingProvider): void {
    this.providers.set(provider.id, provider);
  }
}
