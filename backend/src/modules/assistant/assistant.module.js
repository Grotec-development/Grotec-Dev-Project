var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { GuidanceService } from './guidance.service';
import { OpenAiCompatibleLlmProvider } from './llm/openai-compatible.provider';
import { ASSISTANT_LLM_PROVIDER } from './llm/llm-provider';
let AssistantModule = class AssistantModule {
};
AssistantModule = __decorate([
    Module({
        imports: [AuditModule, CustomersModule],
        controllers: [AssistantController],
        providers: [
            AssistantService,
            GuidanceService,
            // Default adapter is OpenAI-compatible; swap via the token, never in logic.
            { provide: ASSISTANT_LLM_PROVIDER, useClass: OpenAiCompatibleLlmProvider },
        ],
        exports: [ASSISTANT_LLM_PROVIDER],
    })
], AssistantModule);
export { AssistantModule };
