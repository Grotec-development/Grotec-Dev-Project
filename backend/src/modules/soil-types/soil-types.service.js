var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

let SoilTypesService = class SoilTypesService {
    constructor(prisma) {
        this.prisma = prisma;
    }

    async list(includeInactive = false) {
        return this.prisma.soilType.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: { nameEn: 'asc' },
        });
    }

    async getById(id) {
        const soil = await this.prisma.soilType.findUnique({ where: { id } });
        if (!soil) {
            throw ApiError.notFound('SOIL_TYPE_NOT_FOUND', 'Soil type not found');
        }
        return soil;
    }

    async create(actor, data) {
        const code = (data.code || data.nameEn || '').trim().toUpperCase().replace(/\s+/g, '_');
        if (!code) throw ApiError.badRequest('CODE_REQUIRED', 'Soil code is required');
        const existing = await this.prisma.soilType.findUnique({ where: { code } });
        if (existing) throw ApiError.conflict('SOIL_TYPE_EXISTS', 'Soil type with this code already exists');

        return this.prisma.soilType.create({
            data: {
                code,
                nameEn: data.nameEn,
                nameTa: data.nameTa || data.nameEn,
                description: data.description || null,
                isActive: data.isActive !== undefined ? data.isActive : true,
            },
        });
    }

    async update(actor, id, data) {
        await this.getById(id);
        return this.prisma.soilType.update({
            where: { id },
            data: {
                ...(data.nameEn ? { nameEn: data.nameEn } : {}),
                ...(data.nameTa ? { nameTa: data.nameTa } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
    }
};

SoilTypesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], SoilTypesService);

export { SoilTypesService };
