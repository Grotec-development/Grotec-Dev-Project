import { Injectable } from '@nestjs/common';
import { CustomerStatus, Prisma, PrismaClient } from '@prisma/client';
import { normalizePhoneToE164 } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage, type PageParams } from '../../common/utils/pagination';
import type { CropInputDto, LocationInputDto, PhoneInputDto } from './dto/customer-input.dto';

const LIVE_PHONE: Prisma.CustomerPhoneWhereInput = { deletedAt: null };

export interface CustomerFilters {
  q?: string;
  phone?: string;
  status?: CustomerStatus;
  cropId?: string;
  ownerId?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- list/search

  async list(actor: AuthEmployee, pagination: PageParams, filters: CustomerFilters) {
    const conditions: Prisma.CustomerWhereInput[] = [{ deletedAt: null }, this.visibilityWhere(actor)];

    if (filters.q) {
      const digits = filters.q.replace(/\D/g, '');
      conditions.push({
        OR: [
          { fullName: { contains: filters.q, mode: 'insensitive' } },
          ...(digits.length >= 3
            ? [{ phones: { some: { ...LIVE_PHONE, phoneE164: { contains: digits } } } }]
            : []),
        ],
      });
    }
    if (filters.phone) {
      const e164 = normalizePhoneToE164(filters.phone);
      if (e164) conditions.push({ phones: { some: { ...LIVE_PHONE, phoneE164: e164 } } });
      else return toPage([], 0, pagination);
    }
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.cropId) {
      conditions.push({ crops: { some: { cropId: filters.cropId, deletedAt: null } } });
    }
    if (filters.ownerId) {
      conditions.push({
        leads: {
          some: {
            deletedAt: null,
            ownerships: { some: { employeeId: filters.ownerId, releasedAt: null } },
          },
        },
      });
    }

    const where: Prisma.CustomerWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return toPage(
      rows.map((customer) => ({
        id: customer.id,
        farmerCode: customer.farmerCode,
        fullName: customer.fullName,
        status: customer.status,
        primaryPhone: customer.phones[0]?.phoneE164 ?? null,
        phoneCount: customer.phones.length,
        createdAt: customer.createdAt,
      })),
      total,
      pagination,
    );
  }

  async lookupByPhone(rawPhone: string) {
    const e164 = normalizePhoneToE164(rawPhone);
    if (!e164) throw ApiError.badRequest('INVALID_PHONE', 'Phone number could not be normalized');
    const match = await this.prisma.customerPhone.findFirst({
      where: { ...LIVE_PHONE, phoneE164: e164, customer: { deletedAt: null } },
      include: { customer: true },
    });
    if (!match) {
      throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer found for this number');
    }
    return {
      customerId: match.customerId,
      fullName: match.customer.fullName,
      status: match.customer.status,
      phone: match.phoneE164,
    };
  }

  // ------------------------------------------------------------------- profile

  async detailOrThrow(id: string, actor: AuthEmployee) {
    const where: Prisma.CustomerWhereInput = {
      id,
      deletedAt: null,
      AND: [this.visibilityWhere(actor)],
    };
    const customer = await this.prisma.customer.findFirst({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true } },
        phones: { where: LIVE_PHONE, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        crops: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { crop: { select: { id: true, code: true, name: true, localName: true } } },
        },
        leads: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { ownerships: { where: { releasedAt: null }, include: { employee: { select: { id: true, fullName: true } } } } },
        },
      },
    });
    if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    return serializeCustomerDetail(customer);
  }

  // -------------------------------------------------------------------- create

  async create(actor: AuthEmployee, dto: {
    fullName: string;
    phones: { phones: PhoneInputDto[] };
    locations?: { locations: LocationInputDto[] };
    crops?: { crops: CropInputDto[] };
  }) {
    const phoneInputs = dto.phones.phones;
    const locations = dto.locations?.locations ?? [];
    const cropInputs = dto.crops?.crops ?? [];

    const normalized = this.normalizeAndValidatePhones(phoneInputs);
    const desiredPrimaryIndex = phoneInputs.findIndex((p) => p.isPrimary === true);
    if (phoneInputs.filter((p) => p.isPrimary === true).length > 1) {
      throw ApiError.badRequest('SINGLE_PRIMARY_PHONE', 'Only one phone can be primary');
    }
    const primaryIndex = desiredPrimaryIndex === -1 ? 0 : desiredPrimaryIndex;

    const seen = new Set<string>();
    for (const e164 of normalized) {
      if (seen.has(e164)) throw ApiError.badRequest('DUPLICATE_PHONE_IN_REQUEST', `Phone ${e164} listed more than once`);
      seen.add(e164);
    }
    const duplicate = await this.prisma.customerPhone.findFirst({
      where: { ...LIVE_PHONE, phoneE164: { in: [...seen] } },
      include: { customer: true },
    });
    if (duplicate) throw this.phoneConflict(duplicate);

    const locationInputs = this.validateLocations(locations);
    const crops = await this.validateCrops(cropInputs, actor);

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          farmerCode: await nextFarmerCode(tx),
          fullName: dto.fullName,
          createdById: actor.id,
        },
      });
      await tx.customerPhone.createMany({
        data: normalized.map((e164, index) => ({
          customerId: customer.id,
          phoneE164: e164,
          rawInput: phoneInputs[index].number,
          kind: phoneInputs[index].kind ?? 'MOBILE',
          isPrimary: index === primaryIndex,
          createdById: actor.id,
        })),
      });
      if (locationInputs.length > 0) {
        await tx.customerLocation.createMany({
          data: locationInputs.map((l, index) => ({
            customerId: customer.id,
            ...l,
            isPrimary: locationInputs.some((x) => x.isPrimary) ? l.isPrimary : index === 0,
            createdById: actor.id,
          })),
        });
      }
      for (const crop of crops) {
        await tx.customerCrop.create({
          data: { customerId: customer.id, ...crop, createdById: actor.id },
        });
      }
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER',
        entityId: customer.id,
        entityLabel: dto.fullName,
        action: 'created',
        after: {
          fullName: dto.fullName,
          phones: normalized,
          locations: locationInputs.length,
          crops: crops.length,
        },
      });
      return customer.id;
    });

    return this.detailOrThrow(created, actor);
  }

  async update(actor: AuthEmployee, id: string, fullName?: string) {
    const existing = await this.scopedCustomer(id, actor);
    if (!fullName || fullName === existing.fullName) return this.detailOrThrow(id, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { fullName } });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER',
        entityId: id,
        entityLabel: fullName,
        action: 'updated',
        before: { fullName: existing.fullName },
        after: { fullName },
      });
    });
    return this.detailOrThrow(id, actor);
  }

  async setActive(actor: AuthEmployee, id: string, active: boolean) {
    const existing = await this.scopedCustomer(id, actor);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { status: active ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER',
        entityId: id,
        entityLabel: existing.fullName,
        action: active ? 'activated' : 'deactivated',
        after: { status: active ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE },
      });
    });
  }

  // -------------------------------------------------------------------- phones

  async addPhone(actor: AuthEmployee, customerId: string, input: PhoneInputDto) {
    await this.scopedCustomer(customerId, actor);
    const e164 = this.normalizeOne(input.number);
    const dup = await this.prisma.customerPhone.findFirst({
      where: { ...LIVE_PHONE, phoneE164: e164 },
      include: { customer: true },
    });
    if (dup) {
      if (dup.customerId === customerId) {
        throw ApiError.conflict('PHONE_ALREADY_EXISTS', 'This number is already on the customer profile', {
          phoneId: dup.id,
        });
      }
      throw this.phoneConflict(dup);
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.customerPhone.updateMany({
          where: { customerId, ...LIVE_PHONE },
          data: { isPrimary: false },
        });
      } else {
        const primary = await tx.customerPhone.findFirst({
          where: { customerId, isPrimary: true, deletedAt: null },
        });
        if (!primary) input.isPrimary = true;
      }
      const created = await tx.customerPhone.create({
        data: {
          customerId,
          phoneE164: e164,
          rawInput: input.number,
          kind: input.kind ?? 'MOBILE',
          isPrimary: input.isPrimary ?? false,
          createdById: actor.id,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_PHONE',
        entityId: created.id,
        entityLabel: e164,
        action: 'created',
        after: { customerId, phoneE164: e164, isPrimary: created.isPrimary },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  async updatePhone(actor: AuthEmployee, customerId: string, phoneId: string, input: { kind?: 'MOBILE' | 'OTHER'; isPrimary?: boolean }) {
    await this.scopedCustomer(customerId, actor);
    const phone = await this.livePhoneOf(customerId, phoneId);

    if (input.isPrimary === true) {
      await this.prisma.$transaction(async (tx) => {
        await tx.customerPhone.updateMany({
          where: { customerId, deletedAt: null, id: { not: phoneId } },
          data: { isPrimary: false },
        });
        const updated = await tx.customerPhone.update({ where: { id: phoneId }, data: { isPrimary: true, kind: input.kind ?? phone.kind } });
        await this.audit.record(tx, {
          actorId: actor.id,
          entityType: 'CUSTOMER_PHONE',
          entityId: phoneId,
          entityLabel: phone.phoneE164,
          action: 'updated',
          before: { isPrimary: phone.isPrimary, kind: phone.kind },
          after: { isPrimary: updated.isPrimary, kind: updated.kind },
        });
      });
    } else {
      if (input.isPrimary === false && phone.isPrimary) {
        const live = await this.prisma.customerPhone.count({
          where: { customerId, deletedAt: null },
        });
        if (live <= 1) {
          throw ApiError.badRequest('LAST_PRIMARY_PHONE', 'A customer must keep one primary phone');
        }
      }
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.customerPhone.update({
          where: { id: phoneId },
          data: { isPrimary: input.isPrimary ?? phone.isPrimary, kind: input.kind ?? phone.kind },
        });
        await this.audit.record(tx, {
          actorId: actor.id,
          entityType: 'CUSTOMER_PHONE',
          entityId: phoneId,
          entityLabel: phone.phoneE164,
          action: 'updated',
          before: { isPrimary: phone.isPrimary, kind: phone.kind },
          after: { isPrimary: updated.isPrimary, kind: updated.kind },
        });
      });
    }
    return this.detailOrThrow(customerId, actor);
  }

  async removePhone(actor: AuthEmployee, customerId: string, phoneId: string) {
    await this.scopedCustomer(customerId, actor);
    const phone = await this.livePhoneOf(customerId, phoneId);
    await this.prisma.$transaction(async (tx) => {
      const liveCount = await tx.customerPhone.count({ where: { customerId, deletedAt: null } });
      if (liveCount <= 1) {
        throw ApiError.badRequest('LAST_PHONE_REQUIRED', 'A customer must keep at least one phone number');
      }
      await tx.customerPhone.update({ where: { id: phoneId }, data: { deletedAt: new Date() } });
      if (phone.isPrimary) {
        const replacement = await tx.customerPhone.findFirst({
          where: { customerId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (replacement) {
          await tx.customerPhone.update({ where: { id: replacement.id }, data: { isPrimary: true } });
        }
      }
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_PHONE',
        entityId: phoneId,
        entityLabel: phone.phoneE164,
        action: 'deleted',
        before: { customerId, phoneE164: phone.phoneE164 },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  // ---------------------------------------------------------------- locations

  async addLocation(actor: AuthEmployee, customerId: string, input: LocationInputDto) {
    await this.scopedCustomer(customerId, actor);
    const data = { ...input };
    await this.prisma.$transaction(async (tx) => {
      if (data.isPrimary === true) {
        await tx.customerLocation.updateMany({ where: { customerId, deletedAt: null }, data: { isPrimary: false } });
      } else {
        const anyPrimary = await tx.customerLocation.findFirst({ where: { customerId, isPrimary: true, deletedAt: null } });
        if (!anyPrimary) data.isPrimary = true;
      }
      const created = await tx.customerLocation.create({
        data: { customerId, ...data, createdById: actor.id },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_LOCATION',
        entityId: created.id,
        entityLabel: locationLabel(created),
        action: 'created',
        after: { customerId, village: data.village ?? null, district: data.district ?? null },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  async updateLocation(actor: AuthEmployee, customerId: string, locationId: string, input: Partial<LocationInputDto>) {
    await this.scopedCustomer(customerId, actor);
    const location = await this.prisma.customerLocation.findFirst({
      where: { id: locationId, customerId, deletedAt: null },
    });
    if (!location) throw ApiError.notFound('LOCATION_NOT_FOUND', 'Location not found');

    await this.prisma.$transaction(async (tx) => {
      if (input.isPrimary === true) {
        await tx.customerLocation.updateMany({ where: { customerId, deletedAt: null }, data: { isPrimary: false } });
      }
      const updated = await tx.customerLocation.update({ where: { id: locationId }, data: { ...input } });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_LOCATION',
        entityId: locationId,
        entityLabel: locationLabel(updated),
        action: 'updated',
        before: { village: location.village, district: location.district },
        after: { village: updated.village, district: updated.district },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  async removeLocation(actor: AuthEmployee, customerId: string, locationId: string) {
    await this.scopedCustomer(customerId, actor);
    const location = await this.prisma.customerLocation.findFirst({
      where: { id: locationId, customerId, deletedAt: null },
    });
    if (!location) throw ApiError.notFound('LOCATION_NOT_FOUND', 'Location not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.customerLocation.update({ where: { id: locationId }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_LOCATION',
        entityId: locationId,
        entityLabel: locationLabel(location),
        action: 'deleted',
        before: { customerId },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  // -------------------------------------------------------------------- crops

  async addCrop(actor: AuthEmployee, customerId: string, input: CropInputDto) {
    await this.scopedCustomer(customerId, actor);
    await this.requireActiveCrop(input.cropId);
    const existing = await this.prisma.customerCrop.findFirst({
      where: { customerId, cropId: input.cropId, deletedAt: null },
    });
    if (existing) throw ApiError.conflict('CUSTOMER_CROP_EXISTS', 'This crop is already recorded for the customer');

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerCrop.create({
        data: {
          customerId,
          cropId: input.cropId,
          acreage: input.acreage,
          unit: input.unit ?? 'acre',
          notes: input.notes ?? null,
          createdById: actor.id,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_CROP',
        entityId: created.id,
        entityLabel: `${input.cropId}`,
        action: 'created',
        after: { customerId, cropId: input.cropId, acreage: input.acreage, unit: input.unit ?? 'acre' },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  async updateCrop(actor: AuthEmployee, customerId: string, customerCropId: string, input: { acreage?: number; unit?: string; notes?: string | null }) {
    await this.scopedCustomer(customerId, actor);
    const row = await this.prisma.customerCrop.findFirst({ where: { id: customerCropId, customerId, deletedAt: null } });
    if (!row) throw ApiError.notFound('CUSTOMER_CROP_NOT_FOUND', 'Crop entry not found');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerCrop.update({
        where: { id: customerCropId },
        data: {
          acreage: input.acreage ?? undefined,
          unit: input.unit ?? undefined,
          notes: input.notes === undefined ? undefined : input.notes,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_CROP',
        entityId: customerCropId,
        entityLabel: row.cropId,
        action: 'updated',
        before: { acreage: row.acreage.toNumber(), unit: row.unit },
        after: { acreage: updated.acreage.toNumber(), unit: updated.unit },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  async removeCrop(actor: AuthEmployee, customerId: string, customerCropId: string) {
    await this.scopedCustomer(customerId, actor);
    const row = await this.prisma.customerCrop.findFirst({ where: { id: customerCropId, customerId, deletedAt: null } });
    if (!row) throw ApiError.notFound('CUSTOMER_CROP_NOT_FOUND', 'Crop entry not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.customerCrop.update({ where: { id: customerCropId }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, {
        actorId: actor.id,
        entityType: 'CUSTOMER_CROP',
        entityId: customerCropId,
        entityLabel: row.cropId,
        action: 'deleted',
        before: { customerId, cropId: row.cropId },
      });
    });
    return this.detailOrThrow(customerId, actor);
  }

  // ------------------------------------------------------------------ helpers

  /** Data-visibility scope — agents see customers they created or hold a current lead on. */
  visibilityWhere(actor: AuthEmployee): Prisma.CustomerWhereInput {
    if (actor.roleCode === 'AGENT') {
      return {
        OR: [
          { createdById: actor.id },
          {
            leads: {
              some: {
                deletedAt: null,
                ownerships: { some: { employeeId: actor.id, releasedAt: null } },
              },
            },
          },
        ],
      };
    }
    return {};
  }

  private async scopedCustomer(id: string, actor: AuthEmployee) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null, AND: [this.visibilityWhere(actor)] },
    });
    if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    return customer;
  }

  private async livePhoneOf(customerId: string, phoneId: string) {
    const phone = await this.prisma.customerPhone.findFirst({
      where: { id: phoneId, customerId, deletedAt: null },
    });
    if (!phone) throw ApiError.notFound('PHONE_NOT_FOUND', 'Phone not found on this customer');
    return phone;
  }

  private normalizeAndValidatePhones(inputs: PhoneInputDto[]): string[] {
    return inputs.map((p) => this.normalizeOne(p.number));
  }

  private normalizeOne(raw: string): string {
    const e164 = normalizePhoneToE164(raw);
    if (!e164) {
      throw ApiError.badRequest('INVALID_PHONE', `Phone number could not be normalized: "${raw}"`, { value: raw });
    }
    return e164;
  }

  private phoneConflict(dup: { customerId: string; phoneE164: string; customer: { id: string; fullName: string; status: string } }) {
    return ApiError.conflict('CUSTOMER_PHONE_EXISTS', 'A customer with this phone number already exists', {
      matchedCustomer: {
        id: dup.customer.id,
        fullName: dup.customer.fullName,
        status: dup.customer.status,
        phone: dup.phoneE164,
      },
    });
  }

  private validateLocations(inputs: LocationInputDto[]): LocationInputDto[] {
    const primaries = inputs.filter((l) => l.isPrimary === true).length;
    if (primaries > 1) throw ApiError.badRequest('SINGLE_PRIMARY_LOCATION', 'Only one location can be primary');
    return inputs;
  }

  private async validateCrops(inputs: CropInputDto[], actor: AuthEmployee): Promise<
    Array<{ cropId: string; acreage: number; unit: string; notes: string | null }>
  > {
    if (inputs.length === 0) return [];
    const ids = [...new Set(inputs.map((c) => c.cropId))];
    const found = await this.prisma.crop.findMany({ where: { id: { in: ids }, isActive: true, } });
    if (found.length !== ids.length) {
      throw ApiError.badRequest('CROP_NOT_FOUND', 'One or more crops do not exist or are inactive');
    }
    return inputs.map((c) => ({
      cropId: c.cropId,
      acreage: c.acreage,
      unit: c.unit ?? 'acre',
      notes: c.notes ?? null,
    }));
  }

  private async requireActiveCrop(cropId: string) {
    const crop = await this.prisma.crop.findFirst({ where: { id: cropId, isActive: true } });
    if (!crop) throw ApiError.badRequest('CROP_NOT_FOUND', 'Crop does not exist or is inactive');
  }
}

function locationLabel(l: { village?: string | null; district?: string | null; taluk?: string | null; addressLine?: string | null }) {
  return l.village || l.taluk || l.district || l.addressLine || 'location';
}

/** Next sequential Farmer ID (GF + 8 zero-padded digits) from farmer_code_seq. */
async function nextFarmerCode(db: Prisma.TransactionClient | PrismaClient): Promise<string> {
  const rows = (await db.$queryRaw`SELECT nextval('farmer_code_seq') AS n`) as Array<{ n: bigint }>;
  const value = Number(rows[0]?.n ?? 0);
  return `GF${String(value).padStart(8, '0')}`;
}

type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: {
    createdBy: { select: { id: true; fullName: true } };
    phones: true;
    locations: true;
    crops: { include: { crop: { select: { id: true; code: true; name: true; localName: true } } } };
    leads: {
      include: {
        ownerships: {
          where: { releasedAt: null };
          include: { employee: { select: { id: true; fullName: true } } };
        };
      };
    };
  };
}>;

function serializeCustomerDetail(customer: CustomerWithRelations) {
  return {
    id: customer.id,
    farmerCode: customer.farmerCode,
    fullName: customer.fullName,
    preferredLanguage: customer.preferredLanguage,
    status: customer.status,
    createdBy: customer.createdBy ?? null,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    phones: customer.phones.map((p) => ({
      id: p.id,
      phone: p.phoneE164,
      rawInput: p.rawInput,
      kind: p.kind,
      isPrimary: p.isPrimary,
      createdAt: p.createdAt,
    })),
    locations: customer.locations.map((l) => ({
      id: l.id,
      addressLine: l.addressLine,
      state: l.state,
      district: l.district,
      taluk: l.taluk,
      village: l.village,
      pincode: l.pincode,
      latitude: l.latitude?.toNumber() ?? null,
      longitude: l.longitude?.toNumber() ?? null,
      isPrimary: l.isPrimary,
    })),
    crops: customer.crops.map((c) => ({
      id: c.id,
      crop: c.crop,
      acreage: c.acreage.toNumber(),
      unit: c.unit,
      notes: c.notes,
    })),
    leads: customer.leads.map((lead) => ({
      id: lead.id,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      createdAt: lead.createdAt,
      currentOwner: lead.ownerships[0]?.employee ?? null,
    })),
  };
}
