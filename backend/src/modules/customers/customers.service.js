var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable } from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { ACTIVE_CALL_STATUSES, DOMAIN_EVENTS, normalizePhoneToE164 } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { ApiError } from '../../common/errors/api-error';
import { DomainEventService } from '../../common/outbox/domain-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
const LIVE_PHONE = { deletedAt: null };
let CustomersService = class CustomersService {
    constructor(prisma, audit, domainEvents) {
        this.prisma = prisma;
        this.audit = audit;
        this.domainEvents = domainEvents;
    }
    // ---------------------------------------------------------------- list/search
    async list(actor, pagination, filters) {
        const conditions = [{ deletedAt: null }, this.visibilityWhere(actor)];
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
            if (e164)
                conditions.push({ phones: { some: { ...LIVE_PHONE, phoneE164: e164 } } });
            else
                return toPage([], 0, pagination);
        }
        if (filters.status)
            conditions.push({ status: filters.status });
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
        const where = { AND: conditions };
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
        return toPage(rows.map((customer) => ({
            id: customer.id,
            farmerCode: customer.farmerCode,
            fullName: customer.fullName,
            status: customer.status,
            primaryPhone: customer.phones[0]?.phoneE164 ?? null,
            phoneCount: customer.phones.length,
            createdAt: customer.createdAt,
        })), total, pagination);
    }
    async lookupByPhone(rawPhone) {
        const e164 = normalizePhoneToE164(rawPhone);
        if (!e164)
            throw ApiError.badRequest('INVALID_PHONE', 'Phone number could not be normalized');
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
    async detailOrThrow(id, actor) {
        await this.assertReadable(id, actor);
        return this.fetchDetail(id);
    }
    /** Read check used by other modules (e.g. calls) before touching a customer. */
    async assertReadable(id, actor) {
        await this.scopedCustomer(id, actor);
    }
    /**
     * Same ownership/role scope as assertReadable (see visibilityWhere), but rejects with
     * 403 instead of 404. Used by callers (e.g. the assistant) that must not fall back to
     * "not found" for a customer the actor simply lacks access to.
     */
    async assertVisible(id, actor) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, deletedAt: null, AND: [this.visibilityWhere(actor)] },
            select: { id: true },
        });
        if (!customer) {
            throw ApiError.forbidden('CUSTOMER_ACCESS_FORBIDDEN', 'You do not have access to this customer');
        }
    }
    /**
     * Full customer context for the calling workspace (PRD §6.3.4/§6.3.5).
     * Callers must already have established access via a call they placed (the
     * resolves-to-existing-customer flow is the point); the agent visibility
     * scope is intentionally not re-applied here so dialing any number can show
     * the matched profile. CallsService enforces the call-ownership gate.
     */
    async detailForCallContext(id) {
        return this.fetchDetail(id);
    }
    async fetchDetail(id) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, deletedAt: null },
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
        if (!customer)
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        return serializeCustomerDetail(customer);
    }
    // -------------------------------------------------------------------- create
    async create(actor, dto) {
        const phoneInputs = dto.phones.phones;
        const locations = dto.locations?.locations ?? [];
        const cropInputs = dto.crops?.crops ?? [];
        const soilType = normalizeSoilType(dto.soilType);
        const normalized = this.normalizeAndValidatePhones(phoneInputs);
        const desiredPrimaryIndex = phoneInputs.findIndex((p) => p.isPrimary === true);
        if (phoneInputs.filter((p) => p.isPrimary === true).length > 1) {
            throw ApiError.badRequest('SINGLE_PRIMARY_PHONE', 'Only one phone can be primary');
        }
        const primaryIndex = desiredPrimaryIndex === -1 ? 0 : desiredPrimaryIndex;
        const seen = new Set();
        for (const e164 of normalized) {
            if (seen.has(e164))
                throw ApiError.badRequest('DUPLICATE_PHONE_IN_REQUEST', `Phone ${e164} listed more than once`);
            seen.add(e164);
        }
        const duplicate = await this.prisma.customerPhone.findFirst({
            where: { ...LIVE_PHONE, phoneE164: { in: [...seen] } },
            include: { customer: true },
        });
        if (duplicate)
            throw this.phoneConflict(duplicate);
        const locationInputs = this.validateLocations(locations);
        const crops = await this.validateCrops(cropInputs, actor);
        const created = await this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.create({
                data: {
                    farmerCode: await nextFarmerCode(tx),
                    fullName: dto.fullName,
                    soilType,
                    createdById: actor.id,
                },
            });
            try {
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
            }
            catch (err) {
                // P2002 on customer_phones_phone_e164_active_idx — a concurrent create
                // raced past the pre-check and now holds the phone. The transaction is
                // rolled back automatically (no orphaned customer or partial phone set).
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    const existing = await tx.customerPhone.findFirst({
                        where: { ...LIVE_PHONE, phoneE164: { in: [...seen] } },
                        include: { customer: true },
                    });
                    if (existing)
                        throw this.phoneConflict(existing);
                }
                throw err;
            }
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
                    soilType,
                    phones: normalized,
                    locations: locationInputs.length,
                    crops: crops.length,
                },
            });
            // Emit customer.created event to the outbox — co-committed with the customer.
            await this.domainEvents.emit(tx, {
                eventType: DOMAIN_EVENTS.CUSTOMER_CREATED,
                aggregateType: 'customer',
                aggregateId: customer.id,
                actorId: actor.id,
                payload: {
                    farmerCode: customer.farmerCode,
                    fullName: dto.fullName,
                    phoneCount: normalized.length,
                },
            });
            // PRD §6.3.5 — a customer created during an active call must not end the
            // call; link any in-flight call dialed to one of these numbers instead.
            const orphanedCalls = await tx.call.findMany({
                where: { customerId: null, phoneNumber: { in: [...seen] }, status: { in: [...ACTIVE_CALL_STATUSES] } },
            });
            if (orphanedCalls.length > 0) {
                await tx.call.updateMany({
                    where: { id: { in: orphanedCalls.map((call) => call.id) } },
                    data: { customerId: customer.id },
                });
                for (const call of orphanedCalls) {
                    await this.audit.record(tx, {
                        actorId: actor.id,
                        entityType: 'CALL',
                        entityId: call.id,
                        entityLabel: call.phoneNumber,
                        action: 'call.linked',
                        after: { customerId: customer.id },
                    });
                }
            }
            return customer.id;
        });
        return this.detailOrThrow(created, actor);
    }
    /**
     * Partial update. A field is only touched when the caller actually supplied it:
     *   - key omitted (undefined)      -> preserved
     *   - soilType null or blank       -> cleared to NULL
     *   - non-empty value              -> set
     * So a fullName-only PATCH never disturbs soilType, and vice versa. Audit
     * before/after carry exactly the fields that changed.
     */
    async update(actor, id, dto) {
        const existing = await this.scopedCustomer(id, actor);
        const data = {};
        const before = {};
        const after = {};
        // Falsy fullName is ignored, matching the previous behaviour.
        if (dto.fullName && dto.fullName !== existing.fullName) {
            data.fullName = dto.fullName;
            before.fullName = existing.fullName;
            after.fullName = dto.fullName;
        }
        if (dto.soilType !== undefined) {
            const nextSoilType = normalizeSoilType(dto.soilType);
            if (nextSoilType !== existing.soilType) {
                data.soilType = nextSoilType;
                before.soilType = existing.soilType;
                after.soilType = nextSoilType;
            }
        }
        // Nothing actually changed — no write, no audit row, no event.
        if (Object.keys(data).length === 0)
            return this.detailOrThrow(id, actor);
        await this.prisma.$transaction(async (tx) => {
            const updated = await tx.customer.update({ where: { id }, data });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CUSTOMER',
                entityId: id,
                entityLabel: updated.fullName,
                action: 'updated',
                before,
                after,
            });
            await this.domainEvents.emit(tx, {
                eventType: DOMAIN_EVENTS.CUSTOMER_UPDATED,
                aggregateType: 'customer',
                aggregateId: id,
                actorId: actor.id,
                payload: { fullName: updated.fullName, ...after },
            });
        });
        return this.detailOrThrow(id, actor);
    }
    async setActive(actor, id, active) {
        const existing = await this.scopedCustomer(id, actor);
        const newStatus = active ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE;
        await this.prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: { id },
                data: { status: newStatus },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CUSTOMER',
                entityId: id,
                entityLabel: existing.fullName,
                action: active ? 'activated' : 'deactivated',
                after: { status: newStatus },
            });
            await this.domainEvents.emit(tx, {
                eventType: active ? DOMAIN_EVENTS.CUSTOMER_ACTIVATED : DOMAIN_EVENTS.CUSTOMER_DEACTIVATED,
                aggregateType: 'customer',
                aggregateId: id,
                actorId: actor.id,
                payload: { status: newStatus },
            });
        });
    }
    // -------------------------------------------------------------------- phones
    async addPhone(actor, customerId, input) {
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
            }
            else {
                const primary = await tx.customerPhone.findFirst({
                    where: { customerId, isPrimary: true, deletedAt: null },
                });
                if (!primary)
                    input.isPrimary = true;
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
    async updatePhone(actor, customerId, phoneId, input) {
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
        }
        else {
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
    async removePhone(actor, customerId, phoneId) {
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
    async addLocation(actor, customerId, input) {
        await this.scopedCustomer(customerId, actor);
        const data = { ...input };
        await this.prisma.$transaction(async (tx) => {
            if (data.isPrimary === true) {
                await tx.customerLocation.updateMany({ where: { customerId, deletedAt: null }, data: { isPrimary: false } });
            }
            else {
                const anyPrimary = await tx.customerLocation.findFirst({ where: { customerId, isPrimary: true, deletedAt: null } });
                if (!anyPrimary)
                    data.isPrimary = true;
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
    async updateLocation(actor, customerId, locationId, input) {
        await this.scopedCustomer(customerId, actor);
        const location = await this.prisma.customerLocation.findFirst({
            where: { id: locationId, customerId, deletedAt: null },
        });
        if (!location)
            throw ApiError.notFound('LOCATION_NOT_FOUND', 'Location not found');
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
    async removeLocation(actor, customerId, locationId) {
        await this.scopedCustomer(customerId, actor);
        const location = await this.prisma.customerLocation.findFirst({
            where: { id: locationId, customerId, deletedAt: null },
        });
        if (!location)
            throw ApiError.notFound('LOCATION_NOT_FOUND', 'Location not found');
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
    async addCrop(actor, customerId, input) {
        await this.scopedCustomer(customerId, actor);
        await this.requireActiveCrop(input.cropId);
        const existing = await this.prisma.customerCrop.findFirst({
            where: { customerId, cropId: input.cropId, deletedAt: null },
        });
        if (existing)
            throw ApiError.conflict('CUSTOMER_CROP_EXISTS', 'This crop is already recorded for the customer');
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
    async updateCrop(actor, customerId, customerCropId, input) {
        await this.scopedCustomer(customerId, actor);
        const row = await this.prisma.customerCrop.findFirst({ where: { id: customerCropId, customerId, deletedAt: null } });
        if (!row)
            throw ApiError.notFound('CUSTOMER_CROP_NOT_FOUND', 'Crop entry not found');
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
    async removeCrop(actor, customerId, customerCropId) {
        await this.scopedCustomer(customerId, actor);
        const row = await this.prisma.customerCrop.findFirst({ where: { id: customerCropId, customerId, deletedAt: null } });
        if (!row)
            throw ApiError.notFound('CUSTOMER_CROP_NOT_FOUND', 'Crop entry not found');
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
    // -------------------------------------------------------------------- notes
    async listNotes(customerId, actor) {
        await this.assertReadable(customerId, actor);
        const notes = await this.prisma.customerNote.findMany({
            where: { customerId },
            include: { author: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return notes.map((note) => ({
            id: note.id,
            body: note.body,
            createdAt: note.createdAt,
            author: note.author,
        }));
    }
    async addNote(customerId, actor, body) {
        const customer = await this.scopedCustomer(customerId, actor);
        const note = await this.prisma.$transaction(async (tx) => {
            const created = await tx.customerNote.create({
                data: { customerId, authorId: actor.id, body },
                include: { author: { select: { id: true, fullName: true, email: true } } },
            });
            await this.audit.record(tx, {
                actorId: actor.id,
                entityType: 'CUSTOMER_NOTE',
                entityId: created.id,
                entityLabel: customer.fullName,
                action: 'customer.note_added',
                after: { customerId, body: body.slice(0, 200) },
            });
            return created;
        });
        return {
            id: note.id,
            body: note.body,
            createdAt: note.createdAt,
            author: note.author,
        };
    }
    // ------------------------------------------------------------------ helpers
    /** Data-visibility scope — agents see customers they created or hold a current lead on. */
    visibilityWhere(actor) {
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
    async scopedCustomer(id, actor) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, deletedAt: null, AND: [this.visibilityWhere(actor)] },
        });
        if (!customer)
            throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
        return customer;
    }
    async livePhoneOf(customerId, phoneId) {
        const phone = await this.prisma.customerPhone.findFirst({
            where: { id: phoneId, customerId, deletedAt: null },
        });
        if (!phone)
            throw ApiError.notFound('PHONE_NOT_FOUND', 'Phone not found on this customer');
        return phone;
    }
    normalizeAndValidatePhones(inputs) {
        return inputs.map((p) => this.normalizeOne(p.number));
    }
    normalizeOne(raw) {
        const e164 = normalizePhoneToE164(raw);
        if (!e164) {
            throw ApiError.badRequest('INVALID_PHONE', `Phone number could not be normalized: "${raw}"`, { value: raw });
        }
        return e164;
    }
    phoneConflict(dup) {
        return ApiError.conflict('CUSTOMER_PHONE_EXISTS', 'A customer with this phone number already exists', {
            matchedCustomer: {
                id: dup.customer.id,
                fullName: dup.customer.fullName,
                status: dup.customer.status,
                phone: dup.phoneE164,
            },
        });
    }
    validateLocations(inputs) {
        const primaries = inputs.filter((l) => l.isPrimary === true).length;
        if (primaries > 1)
            throw ApiError.badRequest('SINGLE_PRIMARY_LOCATION', 'Only one location can be primary');
        return inputs;
    }
    async validateCrops(inputs, actor) {
        if (inputs.length === 0)
            return [];
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
    async requireActiveCrop(cropId) {
        const crop = await this.prisma.crop.findFirst({ where: { id: cropId, isActive: true } });
        if (!crop)
            throw ApiError.badRequest('CROP_NOT_FOUND', 'Crop does not exist or is inactive');
    }
};
CustomersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof DomainEventService !== "undefined" && DomainEventService) === "function" ? _c : Object])
], CustomersService);
export { CustomersService };
/**
 * Optional free-text soil type. undefined, null and blank all normalize to NULL;
 * anything else is trimmed. No controlled vocabulary is applied — none is approved.
 */
function normalizeSoilType(value) {
    if (value === undefined || value === null)
        return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
}
function locationLabel(l) {
    return l.village || l.taluk || l.district || l.addressLine || 'location';
}
/** Next sequential Farmer ID (GF + 8 zero-padded digits) from farmer_code_seq. */
async function nextFarmerCode(db) {
    const rows = (await db.$queryRaw `SELECT nextval('farmer_code_seq') AS n`);
    const value = Number(rows[0]?.n ?? 0);
    return `GF${String(value).padStart(8, '0')}`;
}
function serializeCustomerDetail(customer) {
    return {
        id: customer.id,
        farmerCode: customer.farmerCode,
        fullName: customer.fullName,
        preferredLanguage: customer.preferredLanguage,
        soilType: customer.soilType,
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
