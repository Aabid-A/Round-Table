import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playGame, prepareSetup } from '../../src/cli/setup.js';
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

describe('the game command with a provider that echoes the key', () => {
  it('writes no key into the log or into any error text, and the key still reached the provider', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-scrub-'));
    const castFile = join(dir, 'cast.json');
    writeFileSync(castFile, JSON.stringify(MOCK_CAST.map((c, i) => ({ name: c.name, model: `vendor/model-${i}` }))));
    const before = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = KEY;
    let sentKey = false;
    const provider = (async (_url: string, init?: RequestInit) => {
      sentKey ||= (init?.headers as Record<string, string>).Authorization === `Bearer ${KEY}`;
      return new Response(`invalid credentials for ${KEY}`, { status: 401 });
    }) as unknown as typeof fetch;
    try {
      const setup = prepareSetup({ mock: false, cast: castFile, config: 'config/game.json', timeoutMs: undefined, fetchImpl: provider });
      const log = await playGame(setup, 1);
      const text = JSON.stringify(log);
      expect(sentKey).toBe(true);
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(KEY.slice(0, 12));
      expect(text).toContain('[redacted]'); // the provider's error text is in the log, with the key masked
    } finally {
      if (before === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = before;
    }
  });
});
