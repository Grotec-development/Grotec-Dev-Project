import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { GuidanceService } from './guidance.service';
import { OpenAiCompatibleLlmProvider } from './llm/openai-compatible.provider';
import { ASSISTANT_LLM_PROVIDER } from './llm/llm-provider';

@Module({
  imports: [AuditModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    GuidanceService,
    // Default adapter is OpenAI-compatible; swap via the token, never in logic.
    { provide: ASSISTANT_LLM_PROVIDER, useClass: OpenAiCompatibleLlmProvider },
  ],
  exports: [ASSISTANT_LLM_PROVIDER],
})
export class AssistantModule {}
