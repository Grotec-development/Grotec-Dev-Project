var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
/**
 * Append-only audit writer. Called inside the same transaction as the mutation
 * it records so audit rows can never diverge from the change they describe.
 */
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
            // Local dev databases (e.g. Windows WIN1252) may reject rare unicode sequences
            console.warn('Audit record warning:', err instanceof Error ? err.message : String(err));
        }
    }
    /** Convenience for record() outside a transaction (already-committed facts). */
    async recordDirect(input) {
        await this.record(this.prisma, input);
    }
};
AuditService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], AuditService);
export { AuditService };
/** JSON-safe conversion: Dates → ISO, BigInt/Decimal → string, cleans Unicode for db. */
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
