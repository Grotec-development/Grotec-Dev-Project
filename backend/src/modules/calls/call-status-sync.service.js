var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CallStatusSyncService_1;
var _a, _b, _c, _d;
import { Injectable, Logger } from '@nestjs/common';
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
let CallStatusSyncService = CallStatusSyncService_1 = class CallStatusSyncService {
    constructor(prisma, dialers, calls, config) {
        this.prisma = prisma;
        this.dialers = dialers;
        this.calls = calls;
        this.config = config;
        this.logger = new Logger(CallStatusSyncService_1.name);
        this.timer = null;
    }
    onModuleInit() {
        const raw = this.config.get('DIALER_SYNC_MS');
        const intervalMs = raw === undefined ? Number.NaN : Number(raw);
        if (!Number.isFinite(intervalMs) || intervalMs <= 0)
            return;
        this.timer = setInterval(() => {
            void this.syncActive().catch((error) => this.logger.error(`call status sync failed: ${String(error)}`));
        }, intervalMs);
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async syncActive(limit = 25) {
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
};
CallStatusSyncService = CallStatusSyncService_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof DialerRegistry !== "undefined" && DialerRegistry) === "function" ? _b : Object, typeof (_c = typeof CallsService !== "undefined" && CallsService) === "function" ? _c : Object, typeof (_d = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _d : Object])
], CallStatusSyncService);
export { CallStatusSyncService };
