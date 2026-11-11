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
  const registry = opts.registry ?? new Registry();
  const runtimes = new Map<string, Runtime>();
  const log = opts.log ?? ((line: string) => console.log(`${new Date().toISOString()} ${line}`));
  const wss = new WebSocketServer({ port: opts.port ?? 0, ...(opts.host ? { host: opts.host } : {}), maxPayload: LIMITS.messageBytes });

  wss.on('connection', (ws) => {
    if (wss.clients.size > LIMITS.connections) {
      ws.close(1013, 'busy');
      return;
    }
    const conn = connOf(ws);
    const session = new Session(conn, {
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
    });
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
