import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller()
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermission(PERMISSIONS.roleRead)
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

  @Get('permissions')
  @RequirePermission(PERMISSIONS.permissionRead)
  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }
}
