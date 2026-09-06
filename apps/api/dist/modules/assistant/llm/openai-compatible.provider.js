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
exports.OpenAiCompatibleLlmProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const llm_provider_1 = require("./llm-provider");
let OpenAiCompatibleLlmProvider = class OpenAiCompatibleLlmProvider {
    logger = new common_1.Logger('OpenAiLlm');
    key;
    baseUrl;
    model;
    constructor(config) {
        this.key = config.get('LLM_API_KEY') || undefined;
        this.baseUrl = (config.get('LLM_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
        this.model = config.get('LLM_MODEL') || 'gpt-4o-mini';
    }
    get available() {
        return Boolean(this.key);
    }
    async complete(messages) {
        if (!this.key)
            throw new llm_provider_1.LlmUnavailableError('LLM_API_KEY is not configured');
        for (let attempt = 0; attempt < 2; attempt++) {
            let response;
            try {
                response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
                    body: JSON.stringify({ model: this.model, messages, temperature: 0.3, max_tokens: 450 }),
                });
            }
            catch (error) {
                this.logger.warn(`LLM request failed: ${error instanceof Error ? error.message : String(error)}`);
                throw new llm_provider_1.LlmUnavailableError('LLM request failed');
            }
            if (response.status === 429 && attempt === 0) {
                this.logger.warn('LLM rate limit reached (429), waiting 3s for token bucket replenishment...');
                await new Promise((resolve) => setTimeout(resolve, 3000));
                continue;
            }
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                this.logger.warn(`LLM responded ${response.status}: ${body.slice(0, 200)}`);
                throw new llm_provider_1.LlmUnavailableError(`LLM responded ${response.status}`);
            }
            const data = (await response.json());
            const content = data.choices?.[0]?.message?.content?.trim();
            if (!content)
                throw new llm_provider_1.LlmUnavailableError('LLM returned an empty completion');
            return content;
        }
        throw new llm_provider_1.LlmUnavailableError('LLM rate limit exceeded after retry');
    }
};
exports.OpenAiCompatibleLlmProvider = OpenAiCompatibleLlmProvider;
exports.OpenAiCompatibleLlmProvider = OpenAiCompatibleLlmProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiCompatibleLlmProvider);
//# sourceMappingURL=openai-compatible.provider.js.map