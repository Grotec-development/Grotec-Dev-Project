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
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { PERMISSIONS, GROTEC_BUSINESS_ROLES, PROPOSED_ROLE_PERMISSIONS, isTopTier } from '@grotec/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

let RolesController = class RolesController {
    constructor(prisma) {
        this.prisma = prisma;
    }

    async listRoles() {
        await this.ensureGrotecRoles();
        const roles = await this.prisma.role.findMany({
            orderBy: { code: 'asc' },
            include: {
                rolePermissions: {
                    include: { permission: { select: { code: true, label: true, category: true, description: true } } },
                },
            },
        });
        return roles.map(({ rolePermissions, ...role }) => ({
            ...role,
            permissions: rolePermissions.map((rp) => rp.permission),
        }));
    }

    async listPermissions() {
        return this.prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
    }

    async updateRolePermissions(actor, id, body) {
        if (!isTopTier(actor.roleCode)) {
            throw ApiError.forbidden('FORBIDDEN', 'Only Founder or Super Admin can modify role permissions');
        }
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw ApiError.notFound('ROLE_NOT_FOUND', 'Role not found');
        }
        if (role.code === 'SUPER_ADMIN') {
            throw ApiError.badRequest('CANNOT_MODIFY_SUPER_ADMIN', 'Super Admin maintains all permissions unconditionally');
        }

        const codes = Array.isArray(body.permissionCodes) ? body.permissionCodes : [];
        const validPermissions = await this.prisma.permission.findMany({
            where: { code: { in: codes } },
            select: { id: true, code: true },
        });

        await this.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
            if (validPermissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: validPermissions.map((p) => ({
                        roleId: role.id,
                        permissionId: p.id,
                    })),
                });
            }
        });

        const updated = await this.prisma.role.findUnique({
            where: { id: role.id },
            include: {
                rolePermissions: {
                    include: { permission: { select: { code: true, label: true, category: true, description: true } } },
                },
            },
        });

        return {
            ...updated,
            permissions: updated.rolePermissions.map((rp) => rp.permission),
        };
    }

    async createRole(actor, body) {
        if (!isTopTier(actor.roleCode)) {
            throw ApiError.forbidden('FORBIDDEN', 'Only Founder or Super Admin can create new roles');
        }
        const code = body.code?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (!code) {
            throw ApiError.badRequest('INVALID_ROLE_CODE', 'Role code is required');
        }
        const existing = await this.prisma.role.findUnique({ where: { code } });
        if (existing) {
            throw ApiError.conflict('ROLE_EXISTS', `Role with code "${code}" already exists`);
        }

        const role = await this.prisma.role.create({
            data: {
                code,
                label: body.label?.trim() || code,
                description: body.description?.trim() || null,
            },
        });

        const codes = Array.isArray(body.permissionCodes) ? body.permissionCodes : [];
        if (codes.length > 0) {
            const validPermissions = await this.prisma.permission.findMany({
                where: { code: { in: codes } },
                select: { id: true },
            });
            if (validPermissions.length > 0) {
                await this.prisma.rolePermission.createMany({
                    data: validPermissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
                });
            }
        }

        return role;
    }

    async ensureGrotecRoles() {
        for (const bizRole of GROTEC_BUSINESS_ROLES) {
            const existing = await this.prisma.role.findUnique({ where: { code: bizRole.code } });
            if (!existing) {
                const created = await this.prisma.role.create({
                    data: {
                        code: bizRole.code,
                        label: bizRole.label,
                        description: bizRole.description,
                    },
                });
                const defaultPerms = PROPOSED_ROLE_PERMISSIONS[bizRole.code] || PROPOSED_ROLE_PERMISSIONS[bizRole.technicalRole] || [];
                if (defaultPerms.length > 0) {
                    const valid = await this.prisma.permission.findMany({
                        where: { code: { in: defaultPerms } },
                        select: { id: true },
                    });
                    if (valid.length > 0) {
                        await this.prisma.rolePermission.createMany({
                            data: valid.map((p) => ({ roleId: created.id, permissionId: p.id })),
                            skipDuplicates: true,
                        });
                    }
                }
            }
        }
    }
};

__decorate([
    Get('roles'),
    RequirePermission(PERMISSIONS.employeeRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "listRoles", null);

__decorate([
    Get('permissions'),
    RequirePermission(PERMISSIONS.employeeRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "listPermissions", null);

__decorate([
    Put('roles/:id/permissions'),
    RequirePermission(PERMISSIONS.employeeUpdate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "updateRolePermissions", null);

__decorate([
    Post('roles'),
    RequirePermission(PERMISSIONS.employeeCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "createRole", null);

RolesController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], RolesController);
export { RolesController };
