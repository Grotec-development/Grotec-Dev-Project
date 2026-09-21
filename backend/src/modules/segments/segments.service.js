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

export const APPROVED_ADVISORY_TEMPLATES = [
  {
    id: 'TPL_SEASONAL_BIO_FERT',
    title: 'Seasonal Bio-Fertilizer Application Advisory',
    channel: 'WHATSAPP',
    language: 'ta',
    category: 'ADVISORY',
    bodyText: 'வணக்கம் {FARMER_NAME}, குரோடெக் இயற்கை உரம் மற்றும் உயிர் உரங்கள் (Bio Jeevan) உங்கள் {CROP_NAME} பயிரின் வேர் வளர்ச்சியை தூண்டி விளைச்சலை 25-30% வரை அதிகரிக்கும். இலவச ஆலோசனைக்கு உங்கள் குரோடெக் அதிகாரியை தொடர்பு கொள்ளவும்: {FSE_PHONE}.',
  },
  {
    id: 'TPL_PEST_PROTECTION',
    title: 'Organic Pest & Disease Protector Guidance',
    channel: 'WHATSAPP',
    language: 'ta',
    category: 'ADVISORY',
    bodyText: 'அன்புள்ள விவசாயி {FARMER_NAME}, உங்கள் பகுதியில் பூச்சி தாக்குதல் முன்னெச்சரிக்கையாக ஜீவன் சக்தி திரிசூல் (Trishul) மற்றும் அஸ்த்ரா பயன்படுத்த பரிந்துரைக்கப்படுகிறது. 100% இயற்கை தீர்வு. தொடர்பு: {FSE_PHONE}.',
  },
  {
    id: 'TPL_ORDER_CONFIRMATION',
    title: 'Doorstep Delivery Booking Confirmation',
    channel: 'WHATSAPP',
    language: 'en',
    category: 'SERVICE',
    bodyText: 'Dear {FARMER_NAME}, your GROTEC bio-input order has been scheduled for doorstep delivery to {VILLAGE}. Tracking & Driver details will be shared on dispatch.',
  },
];

let SegmentsService = class SegmentsService {
  constructor(prisma, audit) {
    this.prisma = prisma;
    this.audit = audit;
    this.logger = new Logger(SegmentsService.name);
  }

  buildCustomerWhere(filters = {}) {
    const where = { deletedAt: null };

    if (filters.cropId || filters.cropName) {
      where.crops = {
        some: {
          deletedAt: null,
          ...(filters.cropId ? { cropId: filters.cropId } : {}),
          ...(filters.cropName
            ? { crop: { name: { contains: filters.cropName, mode: 'insensitive' } } }
            : {}),
        },
      };
    }

    if (filters.district || filters.taluk || filters.village || filters.state) {
      where.locations = {
        some: {
          deletedAt: null,
          ...(filters.state ? { state: { equals: filters.state, mode: 'insensitive' } } : {}),
          ...(filters.district ? { district: { equals: filters.district, mode: 'insensitive' } } : {}),
          ...(filters.taluk ? { taluk: { equals: filters.taluk, mode: 'insensitive' } } : {}),
          ...(filters.village ? { village: { equals: filters.village, mode: 'insensitive' } } : {}),
        },
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fseId) {
      where.OR = [
        { createdById: filters.fseId },
        {
          relationshipOwnership: {
            some: { employeeId: filters.fseId, releasedAt: null },
          },
        },
      ];
    }

    if (filters.productId) {
      where.salesOrders = {
        some: {
          items: { some: { productId: filters.productId } },
        },
      };
    }

    return where;
  }

  async querySegment(actor, filters = {}) {
    const where = this.buildCustomerWhere(filters);
    const limit = Math.min(Number(filters.limit) || 50, 200);

    const [totalCount, farmers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          phones: { where: { isPrimary: true, deletedAt: null }, take: 1 },
          locations: { where: { isPrimary: true, deletedAt: null }, take: 1 },
          crops: {
            where: { deletedAt: null },
            include: { crop: { select: { name: true } } },
            take: 3,
          },
          relationshipOwnership: {
            where: { releasedAt: null },
            include: { employee: { select: { id: true, fullName: true } } },
            take: 1,
          },
        },
      }),
    ]);

    const formatted = farmers.map((f) => {
      const loc = f.locations[0] || {};
      const cropNames = f.crops.map((c) => c.crop.name).join(', ');
      const rm = f.relationshipOwnership[0]?.employee?.fullName || '—';
      return {
        id: f.id,
        farmerCode: f.farmerCode || `GF${f.id.slice(0, 8)}`,
        fullName: f.fullName,
        phone: f.phones[0]?.phoneE164 || '—',
        state: loc.state || 'Tamil Nadu',
        district: loc.district || '—',
        taluk: loc.taluk || '—',
        village: loc.village || '—',
        crops: cropNames || '—',
        status: f.status,
        relationshipOwner: rm,
      };
    });

    return {
      totalMatching: totalCount,
      previewCount: formatted.length,
      farmers: formatted,
    };
  }

  async saveSegment(actor, dto) {
    const name = dto.name?.trim();
    if (!name) {
      throw ApiError.badRequest('NAME_REQUIRED', 'Segment name is required');
    }

    const created = await this.prisma.farmerSegment.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        filterCriteria: dto.filterCriteria || {},
        createdById: actor.id,
        tenantId: actor.tenantId || null,
      },
    });

    await this.audit.recordDirect({
      actorId: actor.id,
      entityType: 'FARMER_SEGMENT',
      entityId: created.id,
      entityLabel: created.name,
      action: 'segment.created',
      meta: created.filterCriteria,
    });

    return created;
  }

  async listSegments(actor) {
    const segments = await this.prisma.farmerSegment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    const withCounts = await Promise.all(
      segments.map(async (seg) => {
        const where = this.buildCustomerWhere(seg.filterCriteria || {});
        const count = await this.prisma.customer.count({ where });
        return {
          id: seg.id,
          name: seg.name,
          description: seg.description,
          filterCriteria: seg.filterCriteria,
          matchingFarmerCount: count,
          createdBy: seg.createdBy?.fullName || 'Admin',
          createdAt: seg.createdAt,
        };
      }),
    );

    return withCounts;
  }

  async deleteSegment(actor, id) {
    const existing = await this.prisma.farmerSegment.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('SEGMENT_NOT_FOUND', 'Segment not found');
    }

    await this.prisma.farmerSegment.delete({ where: { id } });

    await this.audit.recordDirect({
      actorId: actor.id,
      entityType: 'FARMER_SEGMENT',
      entityId: id,
      entityLabel: existing.name,
      action: 'segment.deleted',
    });

    return { success: true };
  }

  async previewCampaign(actor, segmentId, dto = {}) {
    const segment = await this.prisma.farmerSegment.findUnique({ where: { id: segmentId } });
    if (!segment) {
      throw ApiError.notFound('SEGMENT_NOT_FOUND', 'Segment not found');
    }

    const template = APPROVED_ADVISORY_TEMPLATES.find((t) => t.id === dto.templateId) || APPROVED_ADVISORY_TEMPLATES[0];
    const where = this.buildCustomerWhere(segment.filterCriteria || {});
    const totalEligible = await this.prisma.customer.count({ where });

    return {
      segmentId: segment.id,
      segmentName: segment.name,
      totalEligibleFarmers: totalEligible,
      templateSelected: template,
      complianceNotice: 'All dispatches strictly adhere to WhatsApp Business Opt-in rules and TRAI DND regulations. Uncontrolled bulk blasts are prohibited.',
      communicationProviderReady: true,
      channelsSupported: ['WHATSAPP', 'SMS'],
      sampleMessage: template.bodyText
        .replace('{FARMER_NAME}', 'K. Murugan')
        .replace('{CROP_NAME}', 'Paddy (CR 1009)')
        .replace('{VILLAGE}', 'Papanasam')
        .replace('{FSE_PHONE}', '+91 94421 88231'),
    };
  }

  getTemplates() {
    return APPROVED_ADVISORY_TEMPLATES;
  }
};

SegmentsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object])
], SegmentsService);

export { SegmentsService };
