import { WebSocketServer, type WebSocket } from 'ws';
import type { GameLog } from '../src/engine/types.js';
import { addressOf } from './address.js';
import { originAllowed } from './config.js';
import { LIMITS, type ServerMessage } from './protocol.js';
import { Registry } from './registry.js';
import { saveLog } from './saveLog.js';
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
  /** Folder to save each finished game's log in. Absent means logs are not saved. */
  logDir?: string;
  /** Take a client's address from the last X-Forwarded-For entry (set this only behind a single reverse proxy you run). */
  trustProxy?: boolean;
  /** Only accept connections from pages on these origins (see parseOrigins). Absent means any origin. */
  allowedOrigins?: string[];
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
  const wss = new WebSocketServer({
    port: opts.port ?? 0,
    ...(opts.host ? { host: opts.host } : {}),
    maxPayload: LIMITS.messageBytes,
    // Refused at the handshake, before a connection exists. A page on another origin cannot talk to this server (and so cannot
    // be used to point a host's key at it, or to make a room on someone's behalf); a connection with no Origin header is refused too.
    verifyClient: (info, done) => {
      if (originAllowed(info.origin, opts.allowedOrigins)) done(true);
      else done(false, 403, 'Origin not allowed');
    },
  });

  const perAddress = new Map<string, number>();
  const maxPerAddress = opts.maxConnectionsPerAddress ?? LIMITS.connectionsPerAddress;

  wss.on('connection', (ws, req) => {
    const address = addressOf(req.headers, req.socket.remoteAddress, opts.trustProxy ?? false);
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
          ...(opts.logDir !== undefined ? { saveLog: (name: string, log: GameLog) => saveLog(opts.logDir as string, name, log) } : {}),
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
