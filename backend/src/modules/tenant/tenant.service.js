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
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

export const DEFAULT_TENANT_SLUG = 'grotec';
export const DEFAULT_TENANT_NAME = 'GROTEC Agrotech Pvt Ltd';

let TenantService = class TenantService {
  constructor(prisma) {
    this.prisma = prisma;
    this.logger = new Logger('TenantService');
    this.defaultTenantId = null;
  }

  async onModuleInit() {
    try {
      const defaultTenant = await this.getOrCreateDefaultTenant();
      this.defaultTenantId = defaultTenant.id;
      this.logger.log(`Multi-tenancy active. Default tenant: ${defaultTenant.name} (${defaultTenant.id})`);
    } catch (err) {
      this.logger.warn(`Tenant initialization deferred: ${err?.message}`);
    }
  }

  async getOrCreateDefaultTenant() {
    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: DEFAULT_TENANT_SLUG },
    });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: DEFAULT_TENANT_NAME,
          slug: DEFAULT_TENANT_SLUG,
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          settings: {
            theme: 'default',
            timezone: 'Asia/Kolkata',
            features: {
              exotelCalling: true,
              whatsappAdvisory: true,
              smtpNotifications: true,
              hrmsIntegrated: true,
            },
          },
        },
      });
      this.logger.log(`Created default tenant: ${tenant.name} (${tenant.slug})`);

      await this.backfillRecords(tenant.id).catch((err) =>
        this.logger.warn(`Backfill notice: ${err?.message}`)
      );
    }

    return tenant;
  }

  async backfillRecords(tenantId) {
    try {
      await this.prisma.employee.updateMany({
        where: { tenantId: null },
        data: { tenantId },
      });
      await this.prisma.customer.updateMany({
        where: { tenantId: null },
        data: { tenantId },
      });
      await this.prisma.lead.updateMany({
        where: { tenantId: null },
        data: { tenantId },
      });
      await this.prisma.call.updateMany({
        where: { tenantId: null },
        data: { tenantId },
      });
      await this.prisma.crop.updateMany({
        where: { tenantId: null },
        data: { tenantId },
      });
    } catch {
      // Ignore if columns do not exist in test mock DB
    }
  }

  async getCurrentTenant(tenantIdOrSlug) {
    if (tenantIdOrSlug) {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          OR: [{ id: tenantIdOrSlug }, { slug: tenantIdOrSlug }],
        },
      });
      if (tenant) return tenant;
    }
    return this.getOrCreateDefaultTenant();
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            employees: true,
            customers: true,
            leads: true,
            calls: true,
          },
        },
      },
    });
  }

  async createTenant(data) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: data.slug.toLowerCase().trim() },
    });
    if (existing) {
      throw ApiError.conflict('TENANT_SLUG_EXISTS', `Tenant with slug '${data.slug}' already exists.`);
    }

    return this.prisma.tenant.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.toLowerCase().trim(),
        plan: data.plan || 'ENTERPRISE',
        status: 'ACTIVE',
        settings: data.settings || {},
      },
    });
  }

  async getTenantById(id) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', `Tenant with id '${id}' not found.`);
    return tenant;
  }
};

TenantService = __decorate([
  Injectable(),
  __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], TenantService);

export { TenantService };
