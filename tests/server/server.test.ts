import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseGameLog } from '../../web/src/replay/parse.js';
import { LIMITS } from '../../server/protocol.js';
import { startServer, type RunningServer } from '../../server/server.js';
import { waitFor } from './helpers.js';
import { TestClient } from './client.js';

describe('the WebSocket server', () => {
  let server: RunningServer;
  const clients: TestClient[] = [];
  const connect = async () => {
    const c = await TestClient.connect(server.port);
    clients.push(c);
    return c;
  };
  beforeEach(async () => {
    server = await startServer({ port: 0, log: () => undefined });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await server.close();
  });

  it('lets two sockets make and join a room', async () => {
    const host = await connect();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const { code } = await host.next('joined');
    const friend = await connect();
    friend.send({ t: 'join', code, name: 'Rae' });
    expect(await friend.next('joined')).toMatchObject({ you: 'Rae', host: false });
    const lobby = await host.next('lobby', host.messages.findIndex((m) => m.t === 'lobby') + 1);
    expect(lobby).toMatchObject({ seats: [{ name: 'Quinn' }, { name: 'Rae' }], aiSeats: 6 });
  });

  it('closes a connection that sends a message over the size limit', async () => {
    const c = await connect();
    c.send(JSON.stringify({ t: 'start', pad: 'x'.repeat(LIMITS.messageBytes + 1) }));
    expect(await c.closed()).toBe(1009);
  });

  it('refuses binary messages and bad JSON without closing', async () => {
    const c = await connect();
    c.ws.send(Buffer.from([1, 2, 3]));
    c.send('nope');
    await waitFor(() => c.messages.length === 2);
    expect(c.messages).toEqual([
      { t: 'error', message: 'Messages must be text.' },
      { t: 'error', message: 'Messages must be JSON.' },
    ]);
    expect(c.closeCode).toBeNull();
  });

  it('keeps a seat when the socket drops and gives it back by token', async () => {
    const host = await connect();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const { code, token } = await host.next('joined');
    const friend = await connect();
    friend.send({ t: 'join', code, name: 'Rae' });
    await friend.next('joined');
    host.close();
    await waitFor(() => friend.messages.some((m) => m.t === 'lobby' && m.seats.some((s) => s.name === 'Quinn' && !s.connected)));
    const back = await connect();
    back.send({ t: 'rejoin', code, token });
    expect(await back.next('joined')).toMatchObject({ you: 'Quinn', host: true });
  });

  it('closes rooms and sockets when the server stops', async () => {
    const host = await connect();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    await host.next('joined');
    await server.close();
    expect(server.registry.size).toBe(0);
    await host.closed();
    server = await startServer({ port: 0, log: () => undefined }); // so afterEach has something to close
  });

  it('refuses connections beyond the limit for one address, and frees the place when one closes', async () => {
    await server.close();
    server = await startServer({ port: 0, log: () => undefined, maxConnectionsPerAddress: 2 });
    const a = await connect();
    const b = await connect();
    const c = await connect();
    expect(await c.closed()).toBe(1013);
    expect(a.closeCode).toBeNull();
    expect(b.closeCode).toBeNull();
    a.close();
    await waitFor(() => a.closeCode !== null);
    const d = await connect();
    d.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    expect(await d.next('joined')).toMatchObject({ you: 'Quinn' });
  });

  it('limits rooms per address through real connections', async () => {
    const hosts = [];
    for (let i = 0; i < 4; i++) {
      const c = await connect();
      c.send({ t: 'create', name: `Host${i}`, mode: 'mock' });
      hosts.push(c);
    }
    await hosts[3]!.next('error');
    expect(hosts[3]!.messages.find((m) => m.t === 'error')).toMatchObject({ message: expect.stringContaining('rooms open') });
    await hosts[0]!.next('joined');
  });

  it('saves a finished game as a log the replay page can open', async () => {
    await server.close();
    const dir = await mkdtemp(join(tmpdir(), 'rt-room-logs-'));
    server = await startServer({ port: 0, log: () => undefined, allowSeed: true, logDir: dir });
    const host = await connect();
    host.autoplay('Quinn');
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 4 });
    const { code } = await host.next('joined');
    host.send({ t: 'start' });
    const done = await host.next('finished');
    const file = join(dir, `room-${code}-seed-4.json`);
    let text = '';
    for (let i = 0; i < 100 && text === ''; i++) {
      text = await readFile(file, 'utf8').catch(() => '');
      if (text === '') await new Promise((r) => setTimeout(r, 20));
    }
    const parsed = parseGameLog(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.log).toEqual(done.log);
    expect(parsed.ok && parsed.log.cast.filter((c) => c.model === 'human').map((c) => c.name)).toEqual(['Quinn']);
  });
});

describe('ALLOWED_ORIGINS', () => {
  let guarded: RunningServer;
  afterEach(async () => {
    await guarded?.close();
  });

  /** Try to open a connection from a page on `origin` (or with no Origin header). Resolves with 'open' or the HTTP status that refused it. */
  const tryConnect = (port: number, origin?: string): Promise<'open' | number> =>
    new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin === undefined ? {} : { origin });
      ws.once('open', () => (ws.close(), resolve('open')));
      ws.once('unexpected-response', (_req, res) => (res.resume(), resolve(res.statusCode ?? 0)));
      ws.once('error', () => undefined);
    });

  it('lets a listed origin in, and the connection works', async () => {
    guarded = await startServer({ port: 0, log: () => undefined, allowedOrigins: ['https://play.example.org'] });
    expect(await tryConnect(guarded.port, 'https://play.example.org')).toBe('open');
    const c = await TestClient.connect(guarded.port, 'https://play.example.org');
    c.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    expect(await c.next('joined')).toMatchObject({ you: 'Quinn' });
    c.close();
  });

  it('refuses another origin, a different scheme or port, and a connection with no Origin header, with a 403 at the handshake', async () => {
    guarded = await startServer({ port: 0, log: () => undefined, allowedOrigins: ['https://play.example.org'] });
    for (const origin of ['https://evil.example', 'http://play.example.org', 'https://play.example.org:8443', 'https://play.example.org.evil.example', 'null']) {
      expect(await tryConnect(guarded.port, origin), origin).toBe(403);
    }
    expect(await tryConnect(guarded.port), 'no Origin header').toBe(403);
  });

  it('refused connections never become rooms or hold a connection place', async () => {
    guarded = await startServer({ port: 0, log: () => undefined, allowedOrigins: ['https://play.example.org'], maxConnectionsPerAddress: 1 });
    for (let i = 0; i < 5; i++) expect(await tryConnect(guarded.port, 'https://evil.example')).toBe(403);
    // The one place per address is still free for a listed origin.
    expect(await tryConnect(guarded.port, 'https://play.example.org')).toBe('open');
    expect(guarded.registry.size).toBe(0);
  });

  it('is open to any origin when no list is set (the default)', async () => {
    guarded = await startServer({ port: 0, log: () => undefined });
    expect(await tryConnect(guarded.port, 'https://anything.example')).toBe('open');
    expect(await tryConnect(guarded.port)).toBe('open');
  });

  /** Start the real server with this ALLOWED_ORIGINS, collect what it prints until `until` appears or it exits, and stop all of it. */
  const startReal = (value: string, until: string): Promise<{ out: string; code: number | null }> =>
    new Promise((resolve) => {
      // Its own process group, so the server that npx starts is stopped too and nothing is left listening.
      const child = spawn('npx', ['tsx', 'server/main.ts'], { detached: true, env: { ...process.env, PORT: '8795', LOG_DIR: 'none', ALLOWED_ORIGINS: value } });
      let out = '';
      let done = false;
      const finish = (code: number | null): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          process.kill(-(child.pid as number), 'SIGKILL');
        } catch {
          /* it had already exited */
        }
        resolve({ out, code });
      };
      const timer = setTimeout(() => finish(null), 20_000);
      const take = (d: Buffer): void => {
        out += d.toString();
        if (out.includes(until)) finish(null);
      };
      child.stdout.on('data', take);
      child.stderr.on('data', take);
      child.on('exit', (code) => finish(code));
    });

  it('stops the real server at start for a bad ALLOWED_ORIGINS', async () => {
    const bad = await startReal('*', 'never printed');
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('ALLOWED_ORIGINS has "*"');
  }, 30_000);

  it('says which origins the real server accepts, for a good ALLOWED_ORIGINS, and leaves nothing running', async () => {
    const good = await startReal('https://Play.example.org/, http://localhost:5173', 'Only these origins may connect');
    expect(good.out).toContain('Only these origins may connect: https://play.example.org, http://localhost:5173.');
    await new Promise((r) => setTimeout(r, 300));
    const probe = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:8795');
      ws.once('open', () => (ws.close(), resolve(true)));
      ws.once('error', () => resolve(false));
    });
    expect(probe, 'the server should be gone').toBe(false);
  }, 30_000);
});

describe('real-model rooms behind a proxy (TRUST_PROXY)', () => {
  let proxied: RunningServer;
  afterEach(async () => {
    await proxied?.close();
  });

  const createReal = async (port: number, headers?: Record<string, string>) => {
    const c = await TestClient.connect(port, undefined, headers);
    c.send({ t: 'create', name: 'Quinn', mode: 'openrouter', key: 'sk-test-proxy-1', models: ['a/b'], maxCostUsd: 1 });
    await waitFor(() => c.messages.some((m) => m.t === 'joined' || m.t === 'error'));
    const first = c.messages.find((m) => m.t === 'joined' || m.t === 'error')!;
    c.close();
    return first;
  };

  it('takes the key when the proxy says https, and refuses it for http, a made-up first entry, or no header', async () => {
    proxied = await startServer({ port: 0, log: () => undefined, trustProxy: true });
    expect((await createReal(proxied.port, { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '203.0.113.1' })).t).toBe('joined');
    for (const headers of [{ 'X-Forwarded-Proto': 'http' }, { 'X-Forwarded-Proto': 'https, http' }, {}] as Record<string, string>[]) {
      const reply = await createReal(proxied.port, headers);
      expect(reply.t, JSON.stringify(headers)).toBe('error');
      expect((reply as { message: string }).message).toContain('cannot tell is https');
    }
  });

  it('still lets a practice room be made over http behind the proxy', async () => {
    proxied = await startServer({ port: 0, log: () => undefined, trustProxy: true });
    const c = await TestClient.connect(proxied.port, undefined, { 'X-Forwarded-Proto': 'http' });
    c.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    expect(await c.next('joined')).toMatchObject({ you: 'Quinn' });
    c.close();
  });

  it('does not look at the header at all without TRUST_PROXY (a person running it on their own machine)', async () => {
    proxied = await startServer({ port: 0, log: () => undefined });
    expect((await createReal(proxied.port, { 'X-Forwarded-Proto': 'http' })).t).toBe('joined');
    expect((await createReal(proxied.port)).t).toBe('joined');
  });
});
