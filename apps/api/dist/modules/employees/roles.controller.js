"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let RolesController = class RolesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
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
exports.RolesController = RolesController;
__decorate([
    (0, common_1.Get)('roles'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Get)('permissions'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.employeeRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "listPermissions", null);
exports.RolesController = RolesController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RolesController);
//# sourceMappingURL=roles.controller.js.map