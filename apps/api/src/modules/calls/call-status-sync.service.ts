import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACTIVE_CALL_STATUSES } from '@grotec/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CallsService } from './calls.service';
import { DialerRegistry } from './dialer/dialer.registry';

/**
 * Background reconciliation ist — the "call-status synchronisation" seam
 * (PRD §6.3.3). Polls the active provider for in-flight calls and applies
 * status changes to the DB. A real vendor would push webhooks instead of
 * being polled; both paths land in CallsService.applySnapshot.
 * Interval (ms) is DIALER_SYNC_MS; <= 0 disables (e.g. integration tests).
 */
@Injectable()
export class CallStatusSyncService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CallStatusSyncService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialers: DialerRegistry,
    private readonly calls: CallsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('DIALER_SYNC_MS');
    const intervalMs = raw === undefined ? Number.NaN : Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    this.timer = setInterval(() => {
      void this.syncActive().catch((error) => this.logger.error(`call status sync failed: ${String(error)}`));
    }, intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async syncActive(limit = 25): Promise<void> {
    const active = await this.prisma.call.findMany({
      where: { status: { in: [...ACTIVE_CALL_STATUSES] } },
      orderBy: { startedAt: 'asc' },
      take: limit,
      select: { id: true, provider: true, providerCallId: true, status: true },
    });
    for (const call of active) {
      await this.calls.syncFromProvider(call);
    }
  }
}