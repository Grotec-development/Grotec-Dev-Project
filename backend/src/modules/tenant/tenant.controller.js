var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@grotec/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantService } from './tenant.service';

let TenantController = class TenantController {
  constructor(tenantService) {
    this.tenantService = tenantService;
  }

  async getCurrentTenant(headerTenantId, headerTenantSlug) {
    const tenant = await this.tenantService.getCurrentTenant(headerTenantId || headerTenantSlug);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      settings: tenant.settings,
    };
  }

  async listTenants() {
    return this.tenantService.listTenants();
  }

  async createTenant(body) {
    return this.tenantService.createTenant(body);
  }
};

__decorate([
  Public(),
  Get('current'),
  ApiOperation({ summary: 'Get current tenant context by ID/slug or default fallback' }),
  __param(0, Headers('x-tenant-id')),
  __param(1, Headers('x-tenant-slug')),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [String, String]),
  __metadata("design:returntype", Promise)
], TenantController.prototype, "getCurrentTenant", null);

__decorate([
  Get(),
  ApiOperation({ summary: 'List all platform tenants (Super Admin / Management)' }),
  RequirePermission(PERMISSIONS.tenantRead),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", []),
  __metadata("design:returntype", Promise)
], TenantController.prototype, "listTenants", null);

__decorate([
  Post(),
  ApiOperation({ summary: 'Create new organization / tenant' }),
  RequirePermission(PERMISSIONS.tenantManage),
  __param(0, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object]),
  __metadata("design:returntype", Promise)
], TenantController.prototype, "createTenant", null);

TenantController = __decorate([
  ApiTags('Multi-Tenancy'),
  ApiBearerAuth(),
  Controller('tenants'),
  __metadata("design:paramtypes", [typeof (_a = typeof TenantService !== "undefined" && TenantService) === "function" ? _a : Object])
], TenantController);

export { TenantController };
