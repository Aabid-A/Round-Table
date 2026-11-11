import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
