import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AutoDialerProvider } from './auto-dialer.types';
import { MockAutoDialerProvider } from './mock-auto-dialer.provider';

/**
 * Selects the active AutoDialerProvider. The mock is registered by default;
 * a production vendor adapter is registered here (config-selected) when chosen —
 * CRM business logic never names a vendor directly.
 */
@Injectable()
export class DialerRegistry {
  private readonly providers = new Map<string, AutoDialerProvider>();
  private readonly defaultId: string;

  constructor(config: ConfigService) {
    this.defaultId = config.get<string>('DIALER_PROVIDER') ?? 'mock';
    this.register(
      new MockAutoDialerProvider({
        providerId: 'mock',
        ringingMs: this.number(config, 'DIALER_RING_MS', 4000),
        connectDelayMs: this.number(config, 'DIALER_CONNECT_MS', 800),
        answerRate: this.number(config, 'DIALER_ANSWER_RATE', 1),
      }),
    );
  }

  get(id?: string | null): AutoDialerProvider {
    const provider = this.providers.get(id ?? this.defaultId) ?? this.providers.get(this.defaultId);
    if (!provider) throw new Error(`No auto-dialer provider registered: ${id ?? this.defaultId}`);
    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  listIds(): string[] {
    return [...this.providers.keys()];
  }

  private register(provider: AutoDialerProvider): void {
    this.providers.set(provider.id, provider);
  }

  private number(config: ConfigService, key: string, fallback: number): number {
    const raw = config.get<string>(key);
    const value = raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
}