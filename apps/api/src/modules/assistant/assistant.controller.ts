import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AssistantService } from './assistant.service';
import { GuidanceService } from './guidance.service';
import { ChatDto } from './dto/chat.dto';
import { CreateGuidanceDto } from './dto/create-guidance.dto';
import { UpdateGuidanceDto } from './dto/update-guidance.dto';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly guidance: GuidanceService,
  ) {}

  // --- Chat (assistant.use: Founder, Manager, Agent/telecaller) ---
  @Post('chat')
  @RequirePermission(PERMISSIONS.assistantUse)
  async chat(@CurrentEmployee() actor: AuthEmployee, @Body() dto: ChatDto) {
    return this.assistant.chat(actor, dto);
  }

  // --- Content management (assistant.manage: Founder, Manager) ---
  @Get('guidance')
  @RequirePermission(PERMISSIONS.assistantManage)
  async listGuidance(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('includeInactive') includeInactive?: string,
    @Query('cropId') cropId?: string,
    @Query('q') q?: string,
  ) {
    return this.guidance.list({ includeInactive: includeInactive === 'true', cropId, q }, actor);
  }

  @Post('guidance')
  @RequirePermission(PERMISSIONS.assistantManage)
  async createGuidance(@CurrentEmployee() actor: AuthEmployee, @Body() dto: CreateGuidanceDto) {
    return this.guidance.create(actor, dto);
  }

  @Patch('guidance/:id')
  @RequirePermission(PERMISSIONS.assistantManage)
  async updateGuidance(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string, @Body() dto: UpdateGuidanceDto) {
    return this.guidance.update(actor, id, dto);
  }
}
