import { Controller, Get, Param } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CallsService } from './calls.service';

@Controller('customers')
export class CustomerCallsController {
  constructor(private readonly calls: CallsService) {}

  @Get(':id/calls')
  @RequirePermission(PERMISSIONS.callRead)
  history(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.calls.customerCalls(id, actor);
  }
}