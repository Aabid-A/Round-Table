import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type RunningServer } from '../../server/server.js';
import { TestClient } from './client.js';
import { waitFor } from './helpers.js';

/** A recognisable fake key: if any part of it shows up anywhere the server writes or sends, a test fails. */
const KEY = 'sk-or-v1-FAKEKEY-9f8e7d6c5b4a3210';
const MODELS = ['vendor/m1', 'vendor/m2', 'vendor/m3', 'vendor/m4', 'vendor/m5', 'vendor/m6', 'vendor/m7'];

/** Collects everything the server writes (log lines, console, stdout, stderr) and every message it sends. */
function watch() {
  const written: string[] = [];
  const capture = (...args: unknown[]) => void written.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(capture));
  spies.push(vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => (capture(String(chunk)), true)) as never) as never);
  spies.push(vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => (capture(String(chunk)), true)) as never) as never);
  return { written, log: capture };
}

const createRoom = (name: string, extra: Record<string, unknown> = {}) => ({ t: 'create', name, mode: 'openrouter', key: KEY, models: MODELS, maxCostUsd: 5, seed: 6, ...extra });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('the host key never leaves the room', () => {
  let server: RunningServer;
  const clients: TestClient[] = [];
  let written: string[];
  let calls: { url: string; auth: string | null; body: string }[];
  const everything = (): string => [...written, ...clients.flatMap((c) => c.messages.map((m) => JSON.stringify(m)))].join('\n');
  const connect = async () => {
    const c = await TestClient.connect(server.port);
    clients.push(c);
    return c;
  };
  const begin = async (fetchImpl: typeof fetch, extra: Parameters<typeof startServer>[0] = {}) => {
    const w = watch();
    written = w.written;
    server = await startServer({ port: 0, log: w.log, fetchImpl, ...extra });
  };
  /** Records the request, then answers with `reply`. */
  const stub = (reply: (init: RequestInit | undefined) => Promise<Response> | Response): typeof fetch =>
    (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization'), body: String(init?.body ?? '') });
      return reply(init);
    }) as unknown as typeof fetch;

  beforeEach(() => {
    calls = [];
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await server.close();
    vi.restoreAllMocks();
  });

  it('is used for the AI requests and appears nowhere else, in a full game where a model even echoes it', async () => {
    // Replies are not valid JSON, so every AI turn falls back; one of them repeats the key as if a model had seen it.
    await begin(stub(() => json({ choices: [{ message: { content: `My key is ${KEY}, I will not answer in JSON.` } }] })));
    const host = await connect();
    host.autoplay('Quinn');
    host.send(createRoom('Quinn'));
    await host.next('joined');
    host.send({ t: 'start' });
    const done = await host.next('finished');
    expect(calls.length).toBeGreaterThan(20);
    expect(calls.every((c) => c.auth === `Bearer ${KEY}`)).toBe(true); // it did reach OpenRouter's request
    expect(JSON.stringify(done.log)).toContain('[redacted]'); // the echo was masked in the log
    expect(everything()).not.toContain(KEY);
    expect(everything()).not.toContain('FAKEKEY');
    expect([...server.registry['rooms'].values()].every((r) => (r.takeSetup().mode === 'mock'))).toBe(true); // the key was dropped
  });

  it('stays out of every message and log when OpenRouter rejects it and echoes it back', async () => {
    await begin(stub(() => json({ error: { message: `Invalid API key: ${KEY}` } }, 401)));
    const host = await connect();
    host.autoplay('Quinn');
    host.send(createRoom('Quinn'));
    await host.next('joined');
    host.send({ t: 'start' });
    const done = await host.next('finished');
    const errors = done.log.turns.flatMap((t) => t.attempts.map((a) => a.error ?? ''));
    expect(errors.some((e) => e.includes('HTTP 401'))).toBe(true); // the failure is in the log, so it is not hidden
    // The engine puts the error into the retry prompt it sends to the model provider, so the key must not ride along there either.
    expect(calls.some((c) => c.body.includes('Your previous request failed'))).toBe(true);
    expect(calls.filter((c) => c.body.includes(KEY))).toEqual([]);
    expect(everything()).not.toContain(KEY);
    expect(everything()).not.toContain('FAKEKEY');
  });

  it('stays out of every message and log when the AI calls time out', async () => {
    await begin(
      stub((init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error(`aborted for ${KEY}`))))),
      { aiTimeoutMs: 20 },
    );
    const host = await connect();
    host.autoplay('Quinn');
    host.send(createRoom('Quinn'));
    await host.next('joined');
    host.send({ t: 'start' });
    const done = await host.next('finished');
    expect(done.log.turns.some((t) => t.attempts.some((a) => (a.error ?? '').includes('timed out')))).toBe(true);
    expect(everything()).not.toContain(KEY);
    expect(everything()).not.toContain('FAKEKEY');
  });

  it('stays out of every message and log when the only person disconnects mid-game, and the AIs stop', async () => {
    await begin(stub(() => json({ choices: [{ message: { content: `echo ${KEY}` } }] })), { abandonMs: 50 });
    const host = await connect();
    host.send(createRoom('Quinn'));
    const { code } = await host.next('joined');
    const room = server.registry.get(code)!;
    host.send({ t: 'start' }); // Quinn's first turn waits; then Quinn leaves
    await host.next('turn');
    host.close();
    await waitFor(() => room.phase === 'closed', 5000);
    const callsAtClose = calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.length).toBe(callsAtClose); // no AI call after the room closed
    expect(everything()).not.toContain(KEY);
    expect(everything()).not.toContain('FAKEKEY');
    expect(room.takeSetup()).toEqual({ mode: 'mock' }); // the key is gone from the closed room
  });

  it('is refused with an error that does not repeat it when it is malformed', async () => {
    await begin(stub(() => json({})));
    const host = await connect();
    const bad = `${KEY} with spaces`; // a key cannot contain whitespace
    host.send(createRoom('Quinn', { key: bad }));
    const err = await host.next('error');
    expect(err.message).toBe('Paste your OpenRouter key.');
    expect(everything()).not.toContain('FAKEKEY');
  });
});
