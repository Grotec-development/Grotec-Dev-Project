import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmMessage, LlmProvider, LlmUnavailableError } from './llm-provider';

/**
 * Default adapter: any OpenAI-compatible `/chat/completions` endpoint.
 * Configured purely by env (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL) so no
 * provider/vendor is ever hard-coded into assistant business logic.
 */
@Injectable()
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  private readonly logger = new Logger('OpenAiLlm');
  private readonly key?: string;
  private readonly baseUrl: string;
  readonly model: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('LLM_API_KEY') || undefined;
    this.baseUrl = (config.get<string>('LLM_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.get<string>('LLM_MODEL') || 'gpt-4o-mini';
  }

  get available(): boolean {
    return Boolean(this.key);
  }

  async complete(messages: LlmMessage[]): Promise<string> {
    if (!this.key) throw new LlmUnavailableError('LLM_API_KEY is not configured');

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
          body: JSON.stringify({ model: this.model, messages, temperature: 0.3, max_tokens: 450 }),
        });
      } catch (error) {
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
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new LlmUnavailableError('LLM returned an empty completion');
      return content;
    }
    throw new LlmUnavailableError('LLM rate limit exceeded after retry');
  }
}
