import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { LIMITS, type ServerMessage } from './protocol.js';
import { Registry } from './registry.js';
import type { Conn } from './room.js';
import { Session, type Runtime } from './session.js';

export interface ServerOptions {
  /** 0 picks a free port. */
  port?: number;
  host?: string;
  registry?: Registry;
  turnMs?: number;
  abandonMs?: number;
  sweepMs?: number;
  /** Let the page choose a room's seed (tests and replays only: the seed decides every role). */
  allowSeed?: boolean;
  /** Take a client's address from the first X-Forwarded-For entry (set this only behind a reverse proxy you run). */
  trustProxy?: boolean;
  /** Connections one address may hold. */
  maxConnectionsPerAddress?: number;
  /** Open rooms one address may have (used when no registry is given). */
  maxRoomsPerAddress?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  aiTimeoutMs?: number;
  /** One line per event, never a message's content. */
  log?: (line: string) => void;
}

export interface RunningServer {
  port: number;
  registry: Registry;
  close(): Promise<void>;
}

const PING_MS = 30_000;

/** Where a connection came from: the socket's address, or behind your own reverse proxy the first X-Forwarded-For entry. */
function addressOf(req: IncomingMessage, trustProxy: boolean): string | null {
  const forwarded = trustProxy ? req.headers['x-forwarded-for'] : undefined;
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || null;
}

/** Wrap a socket as the room's Conn: JSON out, and nothing thrown at a socket that already closed. */
function connOf(ws: WebSocket): Conn {
  return {
    send(message: ServerMessage) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    },
    close() {
      ws.close();
    },
  };
}

/** Start the room server. The `ws` library enforces the message size limit; each connection also has a rate limit. */
export function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const registry = opts.registry ?? new Registry(opts.maxRoomsPerAddress !== undefined ? { maxRoomsPerOwner: opts.maxRoomsPerAddress } : {});
  const runtimes = new Map<string, Runtime>();
  const log = opts.log ?? ((line: string) => console.log(`${new Date().toISOString()} ${line}`));
  const wss = new WebSocketServer({ port: opts.port ?? 0, ...(opts.host ? { host: opts.host } : {}), maxPayload: LIMITS.messageBytes });

  const perAddress = new Map<string, number>();
  const maxPerAddress = opts.maxConnectionsPerAddress ?? LIMITS.connectionsPerAddress;

  wss.on('connection', (ws, req) => {
    const address = addressOf(req, opts.trustProxy ?? false);
    const held = address === null ? 0 : (perAddress.get(address) ?? 0);
    if (wss.clients.size > LIMITS.connections || held >= maxPerAddress) {
      ws.close(1013, 'busy');
      return;
    }
    if (address !== null) perAddress.set(address, held + 1);
    const conn = connOf(ws);
    const session = new Session(
      conn,
      {
        registry,
        runtimes,
        options: {
          turnMs: opts.turnMs ?? LIMITS.turnMs,
          abandonMs: opts.abandonMs ?? 2 * 60_000,
          log,
          ...(opts.allowSeed ? { allowSeed: true } : {}),
          ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
          ...(opts.aiTimeoutMs !== undefined ? { aiTimeoutMs: opts.aiTimeoutMs } : {}),
        },
      },
      address,
    );
    let alive = true;
    ws.on('pong', () => (alive = true));
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, PING_MS);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return conn.send({ t: 'error', message: 'Messages must be text.' });
      session.handle(data.toString());
    });
    ws.on('close', () => {
      clearInterval(ping);
      if (address !== null) {
        const left = (perAddress.get(address) ?? 1) - 1;
        if (left <= 0) perAddress.delete(address);
        else perAddress.set(address, left);
      }
      session.disconnect();
    });
    ws.on('error', () => ws.terminate());
  });

  const sweeper = setInterval(() => registry.sweep(), opts.sweepMs ?? 60_000);
  sweeper.unref();

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        registry,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(sweeper);
            registry.closeAll('The server is stopping.');
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
