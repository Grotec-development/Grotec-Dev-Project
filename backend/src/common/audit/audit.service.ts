import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaClient;

export interface AuditInput {
  actorId?: string | null;
  entityType: AuditEntityType | (string & {});
  entityId?: string | null;
  entityLabel?: string | null;
  action: AuditAction | (string & {});
  before?: unknown;
  after?: unknown;
  meta?: unknown;
}

/**
 * Append-only audit writer. Called inside the same transaction as the mutation
 * it records so audit rows can never diverge from the change they describe.
 */
function cleanStringForDb(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  return str
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2248/g, '~')
    .replace(/[\u2000-\u200F\u2028-\u202F\u00A0\uFEFF]/g, ' ')
    .replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 160 && code <= 255) return char;
      if (char === '₹') return 'Rs.';
      return ' ';
    });
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(db: Db, input: AuditInput): Promise<void> {
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
    } catch (err) {
      // Local dev databases (e.g. Windows WIN1252) may reject rare unicode sequences
      console.warn('Audit record warning:', err instanceof Error ? err.message : String(err));
    }
  }

  /** Convenience for record() outside a transaction (already-committed facts). */
  async recordDirect(input: AuditInput): Promise<void> {
    await this.record(this.prisma, input);
  }
}

/** JSON-safe conversion: Dates → ISO, BigInt/Decimal → string, cleans Unicode for db. */
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'string') return cleanStringForDb(v);
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'bigint') return v.toString();
      if (v && typeof v === 'object' && 'toJSON' in v) return v.toJSON();
      return v;
    }),
  ) as Prisma.InputJsonValue;
}
