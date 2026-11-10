import type { Player, PromptRequest } from './player.js';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface OpenRouterOptions {
  model: string;
  apiKey: string;
  timeoutMs?: number;
  url?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Player backed by OpenRouter's OpenAI-compatible chat completions endpoint.
 * Throws on timeout, non-200 or unusable responses; the engine turns that
 * into a retry and then a logged fallback.
 */
export function createOpenRouterPlayer(opts: OpenRouterOptions): Player {
  if (!opts.apiKey) throw new Error('OpenRouter API key is empty');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async respond(req: PromptRequest): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let res: Response;
        let text: string;
        try {
          res = await doFetch(opts.url ?? OPENROUTER_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: opts.model,
              messages: [
                { role: 'system', content: req.system },
                { role: 'user', content: req.user },
              ],
            }),
            signal: controller.signal,
          });
          text = await res.text();
        } catch (e) {
          if (controller.signal.aborted) throw new Error(`request timed out after ${timeoutMs}ms`);
          throw new Error(`request failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        if (res.status !== 200) throw new Error(`OpenRouter returned HTTP ${res.status}: ${text.slice(0, 120)}`);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error('OpenRouter response was not valid JSON');
        }
        const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content === '') throw new Error('OpenRouter response had no message content');
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
