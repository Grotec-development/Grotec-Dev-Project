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
import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
let RolesController = class RolesController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // Role/permission reference endpoints are part of the team tooling — anyone who
    // can read employees (employee.read) may list roles to assign them.
    async listRoles() {
        const roles = await this.prisma.role.findMany({
            orderBy: { code: 'asc' },
            include: {
                rolePermissions: {
                    include: { permission: { select: { code: true, module: true, description: true } } },
                },
            },
        });
        return roles.map(({ rolePermissions, ...role }) => ({
            ...role,
            permissions: rolePermissions.map((rp) => rp.permission),
        }));
    }
    async listPermissions() {
        return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
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
RolesController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], RolesController);
export { RolesController };
