"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallStatusSyncService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@grotec/shared");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const calls_service_1 = require("./calls.service");
const dialer_registry_1 = require("./dialer/dialer.registry");
let CallStatusSyncService = CallStatusSyncService_1 = class CallStatusSyncService {
    prisma;
    dialers;
    calls;
    config;
    logger = new common_1.Logger(CallStatusSyncService_1.name);
    timer = null;
    constructor(prisma, dialers, calls, config) {
        this.prisma = prisma;
        this.dialers = dialers;
        this.calls = calls;
        this.config = config;
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
            where: { status: { in: [...shared_1.ACTIVE_CALL_STATUSES] } },
            orderBy: { startedAt: 'asc' },
            take: limit,
            select: { id: true, provider: true, providerCallId: true, status: true },
        });
        for (const call of active) {
            await this.calls.syncFromProvider(call);
        }
    }
};
exports.CallStatusSyncService = CallStatusSyncService;
exports.CallStatusSyncService = CallStatusSyncService = CallStatusSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        dialer_registry_1.DialerRegistry,
        calls_service_1.CallsService,
        config_1.ConfigService])
], CallStatusSyncService);
//# sourceMappingURL=call-status-sync.service.js.map