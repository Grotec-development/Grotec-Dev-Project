/**
 * Internal LLM abstraction — the assistant never depends on a specific vendor.
 * The default adapter is an OpenAI-compatible chat-completions client
 * (LLM_API_KEY / LLM_BASE_URL / LLM_MODEL); tests and future vendors swap in
 * their own adapter through this DI token.
 */
export const ASSISTANT_LLM_PROVIDER = 'ASSISTANT_LLM_PROVIDER';
/** Thrown when the provider cannot be used (no key, network failure, API error). */
export class LlmUnavailableError extends Error {
}
