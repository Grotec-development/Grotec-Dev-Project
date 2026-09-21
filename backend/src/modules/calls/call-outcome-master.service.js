var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';

export const DEFAULT_CALL_OUTCOMES = [
  {
    code: 'INTERESTED',
    label: 'Interested',
    category: 'POSITIVE',
    reportingMapping: 'INTERESTED',
    requiresFollowUp: false,
    requiresNextAction: true,
    isActive: true,
    displayOrder: 1,
  },
  {
    code: 'CALLBACK_REQUESTED',
    label: 'Callback Requested',
    category: 'POSITIVE',
    reportingMapping: 'INTERESTED',
    requiresFollowUp: true,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 2,
  },
  {
    code: 'FOLLOW_UP_REQUIRED',
    label: 'Follow-up Required',
    category: 'POSITIVE',
    reportingMapping: 'INTERESTED',
    requiresFollowUp: true,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 3,
  },
  {
    code: 'CONVERTED_ORDER',
    label: 'Converted / Order Generated',
    category: 'CONVERTED',
    reportingMapping: 'CONVERTED',
    requiresFollowUp: false,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 4,
  },
  {
    code: 'EXISTING_CUSTOMER',
    label: 'Existing Customer / Service Discussion',
    category: 'GENERAL',
    reportingMapping: 'CONNECTED',
    requiresFollowUp: false,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 5,
  },
  {
    code: 'NOT_INTERESTED',
    label: 'Not Interested',
    category: 'NEGATIVE',
    reportingMapping: 'NOT_INTERESTED',
    requiresFollowUp: false,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 6,
  },
  {
    code: 'NOT_ANSWERED',
    label: 'Not Answered / Busy / Switched Off',
    category: 'RETRY',
    reportingMapping: 'NOT_ANSWERED',
    requiresFollowUp: false,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 7,
  },
  {
    code: 'WRONG_NUMBER',
    label: 'Wrong Number / Invalid Contact',
    category: 'NEGATIVE',
    reportingMapping: 'NOT_CONNECTED',
    requiresFollowUp: false,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 8,
  },
  {
    code: 'COMPLAINT_SERVICE',
    label: 'Complaint / Agronomy Escalation',
    category: 'SUPPORT',
    reportingMapping: 'CONNECTED',
    requiresFollowUp: true,
    requiresNextAction: false,
    isActive: true,
    displayOrder: 9,
  },
];

let CallOutcomeMasterService = class CallOutcomeMasterService {
  constructor(prisma, audit) {
    this.prisma = prisma;
    this.audit = audit;
    this.logger = new Logger(CallOutcomeMasterService.name);
  }

  async list(actor, query = {}) {
    const includeInactive = Boolean(query.includeInactive);
    let items = await this.prisma.callOutcomeMaster.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }],
    });

    if (items.length === 0) {
      // Auto-bootstrap defaults if DB is clean
      await this.bootstrapDefaults(actor?.tenantId || null);
      items = await this.prisma.callOutcomeMaster.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }],
      });
    }

    return items;
  }

  async create(actor, dto) {
    const code = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existing = await this.prisma.callOutcomeMaster.findUnique({
      where: { code },
    });
    if (existing) {
      throw ApiError.conflict('OUTCOME_CODE_EXISTS', `Call outcome with code "${code}" already exists`);
    }

    const created = await this.prisma.callOutcomeMaster.create({
      data: {
        code,
        label: dto.label.trim(),
        category: dto.category || 'GENERAL',
        reportingMapping: dto.reportingMapping || 'CONNECTED',
        requiresFollowUp: Boolean(dto.requiresFollowUp),
        requiresNextAction: Boolean(dto.requiresNextAction),
        isActive: dto.isActive !== false,
        displayOrder: Number(dto.displayOrder) || 0,
        tenantId: actor?.tenantId || null,
      },
    });

    await this.audit.recordDirect({
      actorId: actor.id,
      entityType: 'CALL_OUTCOME_MASTER',
      entityId: created.id,
      entityLabel: created.label,
      action: 'call_outcome.created',
      meta: created,
    });

    return created;
  }

  async update(id, actor, dto) {
    const existing = await this.prisma.callOutcomeMaster.findUnique({
      where: { id },
    });
    if (!existing) {
      throw ApiError.notFound('OUTCOME_NOT_FOUND', 'Call outcome not found');
    }

    const updated = await this.prisma.callOutcomeMaster.update({
      where: { id },
      data: {
        ...(dto.label ? { label: dto.label.trim() } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.reportingMapping ? { reportingMapping: dto.reportingMapping } : {}),
        ...(dto.requiresFollowUp !== undefined ? { requiresFollowUp: Boolean(dto.requiresFollowUp) } : {}),
        ...(dto.requiresNextAction !== undefined ? { requiresNextAction: Boolean(dto.requiresNextAction) } : {}),
        ...(dto.isActive !== undefined ? { isActive: Boolean(dto.isActive) } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: Number(dto.displayOrder) } : {}),
      },
    });

    await this.audit.recordDirect({
      actorId: actor.id,
      entityType: 'CALL_OUTCOME_MASTER',
      entityId: updated.id,
      entityLabel: updated.label,
      action: 'call_outcome.updated',
      meta: updated,
    });

    return updated;
  }

  async bootstrapDefaults(tenantId = null) {
    for (const def of DEFAULT_CALL_OUTCOMES) {
      await this.prisma.callOutcomeMaster.upsert({
        where: { code: def.code },
        update: {},
        create: {
          ...def,
          tenantId,
        },
      });
    }
  }
};

CallOutcomeMasterService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], CallOutcomeMasterService);

export { CallOutcomeMasterService };
