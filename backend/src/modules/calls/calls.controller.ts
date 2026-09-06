import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AddNoteDto } from './dto/add-note.dto';
import { PlaceCallDto } from './dto/place-call.dto';
import { RecordOutcomeDto } from './dto/record-outcome.dto';
import { CallsService } from './calls.service';

@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.callManage)
  place(@CurrentEmployee() actor: AuthEmployee, @Body() dto: PlaceCallDto) {
    return this.calls.placeCall(actor, dto);
  }

  @Get('queue')
  @RequirePermission(PERMISSIONS.callRead)
  queue(@CurrentEmployee() actor: AuthEmployee, @Query('ownerId') ownerId?: string) {
    return this.calls.queue(actor, { ownerId });
  }

  @Get('active')
  @RequirePermission(PERMISSIONS.callRead)
  active(@CurrentEmployee() actor: AuthEmployee) {
    return this.calls.getActiveCall(actor);
  }

  @Get(':id/context')
  @RequirePermission(PERMISSIONS.callRead)
  context(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.calls.callContext(id, actor);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.callRead)
  detail(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.calls.detailOrThrow(id, actor);
  }

  @Post(':id/end')
  @RequirePermission(PERMISSIONS.callManage)
  end(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.calls.endCall(id, actor);
  }

  @Post(':id/notes')
  @RequirePermission(PERMISSIONS.callManage)
  note(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.calls.addNote(id, actor, dto);
  }

  @Post(':id/outcome')
  @RequirePermission(PERMISSIONS.callManage)
  outcome(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: RecordOutcomeDto) {
    return this.calls.recordOutcome(actor, id, dto);
  }
}