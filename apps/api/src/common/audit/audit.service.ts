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
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(db: Db, input: AuditInput): Promise<void> {
    await db.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        action: input.action,
        before: toJsonValue(input.before),
        after: toJsonValue(input.after),
        meta: toJsonValue(input.meta),
      },
    });
  }

  /** Convenience for record() outside a transaction (already-committed facts). */
  async recordDirect(input: AuditInput): Promise<void> {
    await this.record(this.prisma, input);
  }
}

/** JSON-safe conversion: Dates → ISO, BigInt/Decimal → string, drops functions. */
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'bigint') return v.toString();
      if (v && typeof v === 'object' && 'toJSON' in v) return v.toJSON();
      return v;
    }),
  ) as Prisma.InputJsonValue;
}
