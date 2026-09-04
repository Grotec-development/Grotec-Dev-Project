import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS, type FollowUpStatus } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { FollowUpsService } from './followups.service';

@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.callRead)
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.followUps.list(actor, {
      customerId,
      status: status as FollowUpStatus | undefined,
      ownerId,
    });
  }

  @Post(':id/complete')
  @RequirePermission(PERMISSIONS.callManage)
  async complete(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.followUps.complete(actor, id);
  }
}
