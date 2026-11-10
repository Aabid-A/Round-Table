import { describe, expect, it } from 'vitest';
import { MOCK_CAST } from '../../src/players/mock.js';
import { createOpenRouterPlayer, OPENROUTER_URL } from '../../src/players/openrouter.js';
import type { PromptRequest } from '../../src/players/player.js';
import { play, reply } from '../helpers/game.js';

const req: PromptRequest = { system: 'SYS', user: 'USER', phase: 'vote', player: 'Aria', options: ['Bram'] };
const KEY = 'test-key-not-real';
const okBody = (content: unknown): string => JSON.stringify({ choices: [{ message: { content } }] });
const stub = (fn: (url: string, init: RequestInit) => Promise<Response>): typeof fetch =>
  ((url: string, init: RequestInit) => fn(url, init)) as unknown as typeof fetch;

describe('createOpenRouterPlayer', () => {
  it('sends the expected request and returns the message content', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const player = createOpenRouterPlayer({
      model: 'vendor/model-x',
      apiKey: KEY,
      fetchImpl: stub(async (url, init) => {
        seen = { url, init };
        return new Response(okBody('{"hello":1}'), { status: 200 });
      }),
    });
    expect(await player.respond(req)).toBe('{"hello":1}');
    expect(seen?.url).toBe(OPENROUTER_URL);
    expect(seen?.init.method).toBe('POST');
    expect(seen?.init.headers).toEqual({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });
    expect(JSON.parse(seen?.init.body as string)).toEqual({
      model: 'vendor/model-x',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'USER' },
      ],
    });
    expect(seen?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects an empty key', () => {
    expect(() => createOpenRouterPlayer({ model: 'm', apiKey: '' })).toThrow();
  });

  it('times out', async () => {
    const player = createOpenRouterPlayer({
      model: 'm',
      apiKey: KEY,
      timeoutMs: 20,
      fetchImpl: stub(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ),
    });
    await expect(player.respond(req)).rejects.toThrow('timed out after 20ms');
  });

  it('reports a non-200 response', async () => {
    const player = createOpenRouterPlayer({
      model: 'm',
      apiKey: KEY,
      fetchImpl: stub(async () => new Response('rate limited', { status: 429 })),
    });
    await expect(player.respond(req)).rejects.toThrow('HTTP 429');
  });

  it('reports malformed JSON and missing content', async () => {
    const bad = createOpenRouterPlayer({ model: 'm', apiKey: KEY, fetchImpl: stub(async () => new Response('<html>', { status: 200 })) });
    await expect(bad.respond(req)).rejects.toThrow('not valid JSON');
    const empty = createOpenRouterPlayer({ model: 'm', apiKey: KEY, fetchImpl: stub(async () => new Response(okBody(null), { status: 200 })) });
    await expect(empty.respond(req)).rejects.toThrow('no message content');
  });

  it('reports a network failure without leaking the key', async () => {
    const player = createOpenRouterPlayer({
      model: 'm',
      apiKey: KEY,
      fetchImpl: stub(async () => { throw new TypeError('fetch failed'); }),
    });
    await expect(player.respond(req)).rejects.toThrow('request failed: fetch failed');
  });

  it('never throws out of a game: failures become retries and fallbacks', async () => {
    const failures: Record<string, typeof fetch> = {
      timeout: stub((_u, init) => new Promise((_r, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))),
      http: stub(async () => new Response('nope', { status: 500 })),
      malformed: stub(async () => new Response('{{{', { status: 200 })),
      garbage: stub(async () => new Response(okBody('not json at all'), { status: 200 })),
    };
    for (const [kind, fetchImpl] of Object.entries(failures)) {
      const players = Object.fromEntries(
        MOCK_CAST.map((c) => [c.name, createOpenRouterPlayer({ model: 'm', apiKey: KEY, timeoutMs: 5, fetchImpl })]),
      );
      const log = await play(players, 1, { maxRounds: 1 });
      expect(log.turns.length, kind).toBeGreaterThan(0);
      expect(log.turns.every((t) => t.fallback && t.attempts.length === 2), kind).toBe(true);
      expect(JSON.stringify(log)).not.toContain(KEY);
    }
  });

  it('plays a game against a stubbed endpoint that returns valid replies', async () => {
    const fetchImpl = stub(async (_u, init) => {
      const body = JSON.parse(init.body as string) as { messages: { content: string }[] };
      const full = body.messages[1]?.content ?? '';
      const user = full.slice(full.lastIndexOf('\n\n') + 2);
      const options = /Valid (?:targets|choices|suspects|recipients): ([^.]*)\./.exec(user)?.[1]?.split(', ') ?? [];
      let content: string;
      if (user.startsWith('Revote') || user.startsWith('Banishment vote') || user.startsWith('It is night')) content = reply({ target: options[0] });
      else if (user.startsWith('Round table')) content = reply({ suspect: options[0], reason: 'x' }, 'hello');
      else if (user.startsWith('Whispers.')) content = reply({ to: null });
      else if (user.startsWith('Few players')) content = reply({ choice: 'end' });
      else if (user.includes('secretly offers')) content = reply({ accept: false });
      else content = reply({ target: null });
      return new Response(okBody(content), { status: 200 });
    });
    const players = Object.fromEntries(MOCK_CAST.map((c) => [c.name, createOpenRouterPlayer({ model: 'm', apiKey: KEY, fetchImpl })]));
    const log = await play(players, 2);
    expect(log.turns.every((t) => !t.fallback)).toBe(true);
  });
});
