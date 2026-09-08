var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmUnavailableError } from './llm-provider';
/**
 * Default adapter: any OpenAI-compatible `/chat/completions` endpoint.
 * Configured purely by env (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL) so no
 * provider/vendor is ever hard-coded into assistant business logic.
 */
let OpenAiCompatibleLlmProvider = class OpenAiCompatibleLlmProvider {
    constructor(config) {
        this.logger = new Logger('OpenAiLlm');
        this.key = config.get('LLM_API_KEY') || undefined;
        this.baseUrl = (config.get('LLM_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
        this.model = config.get('LLM_MODEL') || 'gpt-4o-mini';
    }
    get available() {
        return Boolean(this.key);
    }
    async complete(messages) {
        if (!this.key)
            throw new LlmUnavailableError('LLM_API_KEY is not configured');
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
                throw new LlmUnavailableError('LLM request failed');
            }
            if (response.status === 429 && attempt === 0) {
                this.logger.warn('LLM rate limit reached (429), waiting 3s for token bucket replenishment...');
                await new Promise((resolve) => setTimeout(resolve, 3000));
                continue;
            }
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                this.logger.warn(`LLM responded ${response.status}: ${body.slice(0, 200)}`);
                throw new LlmUnavailableError(`LLM responded ${response.status}`);
            }
            const data = (await response.json());
            const content = data.choices?.[0]?.message?.content?.trim();
            if (!content)
                throw new LlmUnavailableError('LLM returned an empty completion');
            return content;
        }
        throw new LlmUnavailableError('LLM rate limit exceeded after retry');
    }
};
OpenAiCompatibleLlmProvider = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _a : Object])
], OpenAiCompatibleLlmProvider);
export { OpenAiCompatibleLlmProvider };
