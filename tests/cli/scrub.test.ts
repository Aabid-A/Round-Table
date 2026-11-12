import { describe, expect, it } from 'vitest';
import { scrubFetch, scrubLog, scrubPlayer } from '../../src/cli/scrub.js';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { createOpenRouterPlayer } from '../../src/players/openrouter.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';

const KEY = 'sk-or-v1-0123456789abcdefghijklmnopqrstuv';
const echo = (status: number, body: string): typeof fetch => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('scrubFetch', () => {
  it('masks the key in a response body, as written and as JSON-escaped', async () => {
    const res = await scrubFetch(echo(401, `bad key ${KEY} and "${KEY}"`), [KEY])('https://x', {});
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(text).toContain('[redacted]');
    expect(res.status).toBe(401);
  });

  it('masks the key before the player cuts an error body short, so a half-echoed key cannot survive', async () => {
    const padded = `${'x'.repeat(100)}${KEY}`; // the player keeps only 120 characters of an error body, so the cut would fall inside the key
    const player = createOpenRouterPlayer({ model: 'm', apiKey: KEY, fetchImpl: scrubFetch(echo(500, padded), [KEY]) });
    const message = await player.respond({ system: 's', user: 'u', phase: 'vote' } as never).then(() => '', (e: Error) => e.message);
    expect(message).toContain('HTTP 500');
    expect(message).not.toContain(KEY.slice(0, 8));
  });
});

describe('scrubPlayer', () => {
  it('masks the key in an error the player throws, and keeps the metered flag', async () => {
    const inner = { metered: true, respond: async () => Promise.reject(new Error(`request failed: ${KEY}`)) };
    const player = scrubPlayer(inner, [KEY]);
    expect(player.metered).toBe(true);
    await expect(player.respond({} as never)).rejects.toThrow('request failed: [redacted]');
  });
});

describe('scrubLog', () => {
  it('masks the key everywhere in a finished log, including error text in an attempt', async () => {
    const players = createMockPlayers(MOCK_CAST, 1);
    const first = MOCK_CAST[0]!.name;
    players[first] = scrubPlayer({ respond: async () => Promise.reject(new Error(`boom ${KEY}`)) }, []); // unscrubbed on purpose
    const log = await runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: 1, players, buildPrompt, systemPrompt: SYSTEM_PROMPT, maxModelCalls: 40 });
    expect(JSON.stringify(log)).toContain(KEY);
    const clean = scrubLog(log, [KEY]);
    expect(JSON.stringify(clean)).not.toContain(KEY);
    expect(clean.turns.length).toBe(log.turns.length);
  });
});
