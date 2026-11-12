import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBatch } from '../../src/cli/batch.js';
import { playGame, prepareSetup } from '../../src/cli/setup.js';
import { writeGameLog } from '../../src/log/writer.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';

/** A recognisable fake key: if it, or the front of it, shows up in a written log or a request body, a test fails. */
const KEY = 'sk-or-v1-FAKEKEY-9f8e7d6c5b4a3210';
const prefixes = Array.from({ length: KEY.length - 8 }, (_, i) => KEY.slice(0, i + 9));

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('the command-line path keeps the key out of the log and the prompts', () => {
  let dir: string;
  let bodies: string[];
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', KEY);
    dir = mkdtempSync(join(tmpdir(), 'rt-cli-key-'));
    bodies = [];
  });
  afterEach(() => vi.unstubAllEnvs());

  /** Play one game against a stub provider and return the text of the log file that was written. */
  async function play(reply: () => Response): Promise<string> {
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''));
      return reply();
    }) as unknown as typeof fetch;
    const castPath = join(dir, 'cast.json');
    writeFileSync(castPath, JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, model: `vendor/m${i}` }))));
    const setup = prepareSetup({ mock: false, cast: castPath, config: 'config/game.json', timeoutMs: undefined, fetchImpl });
    const out = join(dir, 'games');
    const { failed } = await runBatch(setup, [1], out, () => {});
    expect(failed).toBe(0);
    const files = readdirSync(out);
    expect(files).toHaveLength(1);
    return readFileSync(join(out, files[0]!), 'utf8');
  }

  function expectClean(written: string): void {
    expect(bodies.length).toBeGreaterThan(8); // the game really called the provider, and retried
    for (const text of [written, ...bodies]) {
      expect(text).not.toContain(KEY);
      for (const p of prefixes) expect(text).not.toContain(p);
    }
  }

  it('when the provider rejects the key and echoes it', async () => {
    const written = await play(() => json({ error: { message: `Invalid API key: ${KEY}` } }, 401));
    expect(written).toContain('HTTP 401');
    expect(written).toContain('[redacted]');
    expectClean(written);
  });

  it('when the key straddles the 120-character cut of the error text', async () => {
    const lead = '{"error":"';
    const pad = 'x'.repeat(100 - lead.length); // the key starts at character 100, so 20 characters of it would survive the cut
    const written = await play(() => new Response(`${lead}${pad}${KEY} is not valid"}`, { status: 401 }));
    expect(written).toContain('HTTP 401');
    expectClean(written);
  });

  it('when a model reply repeats the key', async () => {
    const written = await play(() => json({ choices: [{ message: { content: `My key is ${KEY}, I will not answer in JSON.` } }] }));
    expect(written).toContain('[redacted]');
    expectClean(written);
  });

  // These skip fetch, so only the layers behind it can catch the key.
  it('masks a key that reaches the log without going through fetch', async () => {
    const setup = { ...prepareSetup({ mock: true, cast: undefined, config: 'config/game.json', timeoutMs: undefined }), secrets: [KEY] };
    const leaky = (seed: number) =>
      Object.fromEntries(
        Object.entries(createMockPlayers(MOCK_CAST, seed)).map(([name, p]) => [
          name,
          {
            respond: async (r: Parameters<typeof p.respond>[0]) => {
              if (name === MOCK_CAST[0]!.name) throw new Error(`request failed: bad key ${KEY}`);
              return p.respond(r);
            },
          },
        ]),
      );
    const log = await playGame({ ...setup, makePlayers: leaky }, 1);
    expect(JSON.stringify(log)).toContain('request failed: bad key [redacted]');
    expect(JSON.stringify(log)).not.toContain('FAKEKEY'); // thrown error text is masked before the engine records it
    const raw = { ...log, events: [...log.events, { note: KEY }] } as unknown as typeof log;
    const written = readFileSync(writeGameLog(raw, dir, 'leaky', [KEY]), 'utf8');
    expect(written).toContain('[redacted]');
    for (const p of prefixes) expect(written).not.toContain(p);
  });
});
