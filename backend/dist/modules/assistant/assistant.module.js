"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const assistant_controller_1 = require("./assistant.controller");
const assistant_service_1 = require("./assistant.service");
const guidance_service_1 = require("./guidance.service");
const openai_compatible_provider_1 = require("./llm/openai-compatible.provider");
const llm_provider_1 = require("./llm/llm-provider");
let AssistantModule = class AssistantModule {
};
exports.AssistantModule = AssistantModule;
exports.AssistantModule = AssistantModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule],
        controllers: [assistant_controller_1.AssistantController],
        providers: [
            assistant_service_1.AssistantService,
            guidance_service_1.GuidanceService,
            { provide: llm_provider_1.ASSISTANT_LLM_PROVIDER, useClass: openai_compatible_provider_1.OpenAiCompatibleLlmProvider },
        ],
        exports: [llm_provider_1.ASSISTANT_LLM_PROVIDER],
    })
], AssistantModule);
//# sourceMappingURL=assistant.module.js.map