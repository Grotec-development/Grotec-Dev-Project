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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function cleanStringForDb(str) {
    if (!str)
        return str;
    return str
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/\u2026/g, '...')
        .replace(/\u2248/g, '~')
        .replace(/[\u2000-\u200F\u2028-\u202F\u00A0\uFEFF]/g, ' ')
        .replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0);
        if (code >= 160 && code <= 255)
            return char;
        if (char === '₹')
            return 'Rs.';
        return ' ';
    });
}
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(db, input) {
        try {
            await db.auditEvent.create({
                data: {
                    actorId: input.actorId ?? null,
                    entityType: input.entityType,
                    entityId: input.entityId ?? null,
                    entityLabel: cleanStringForDb(input.entityLabel) ?? null,
                    action: input.action,
                    before: toJsonValue(input.before),
                    after: toJsonValue(input.after),
                    meta: toJsonValue(input.meta),
                },
            });
        }
        catch (err) {
            console.warn('Audit record warning:', err instanceof Error ? err.message : String(err));
        }
    }
    async recordDirect(input) {
        await this.record(this.prisma, input);
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
function toJsonValue(value) {
    if (value === undefined)
        return undefined;
    return JSON.parse(JSON.stringify(value, (_key, v) => {
        if (typeof v === 'string')
            return cleanStringForDb(v);
        if (v instanceof Date)
            return v.toISOString();
        if (typeof v === 'bigint')
            return v.toString();
        if (v && typeof v === 'object' && 'toJSON' in v)
            return v.toJSON();
        return v;
    }));
}
//# sourceMappingURL=audit.service.js.map