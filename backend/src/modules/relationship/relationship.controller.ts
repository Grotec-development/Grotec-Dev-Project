import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AssignRelationshipDto, ReleaseRelationshipDto } from './dto/assign-relationship.dto';
import { RelationshipService } from './relationship.service';

@Controller('relationship')
export class RelationshipController {
  constructor(private readonly relationship: RelationshipService) {}

  @Get('customers')
  @RequirePermission(PERMISSIONS.relationshipRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('rmId') rmId?: string,
    @Query('q') q?: string,
    @Query('unassigned') unassigned?: string,
  ) {
    return this.relationship.list(actor, { rmId, q, unassigned });
  }

  @Get('holders')
  @RequirePermission(PERMISSIONS.relationshipRead)
  async holders() {
    return this.relationship.holders();
  }

  @Post('customers/:customerId/assign')
  @RequirePermission(PERMISSIONS.relationshipManage)
  async assign(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('customerId') customerId: string,
    @Body() dto: AssignRelationshipDto,
  ) {
    return this.relationship.assign(actor, customerId, dto);
  }

  @HttpCode(200)
  @Post('customers/:customerId/release')
  @RequirePermission(PERMISSIONS.relationshipManage)
  async release(
    @CurrentEmployee() actor: AuthEmployee,
    @Param('customerId') customerId: string,
    @Body() dto: ReleaseRelationshipDto,
  ) {
    return this.relationship.release(actor, customerId, dto);
  }
}
