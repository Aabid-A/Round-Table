import { countFromEnv, msFromEnv } from './config.js';
import { startServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be a whole number from 0 to 65535.');
  process.exit(1);
}
const host = process.env.HOST;

let turnMs: number;
let abandonMs: number;
let maxRooms: number;
let maxConnections: number;
try {
  turnMs = msFromEnv(process.env, 'TURN_MS', 90_000);
  abandonMs = msFromEnv(process.env, 'ABANDON_MS', 2 * 60_000);
  maxRooms = countFromEnv(process.env, 'MAX_ROOMS_PER_ADDRESS', 3);
  maxConnections = countFromEnv(process.env, 'MAX_CONNECTIONS_PER_ADDRESS', 20);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const allowSeed = process.env.ALLOW_SEED === '1';
if (allowSeed) console.warn('ALLOW_SEED=1: pages can choose a room\'s seed, which decides every role. Use this for tests only.');

const trustProxy = process.env.TRUST_PROXY === '1';

const server = await startServer({ port, turnMs, abandonMs, maxRoomsPerAddress: maxRooms, maxConnectionsPerAddress: maxConnections, ...(allowSeed ? { allowSeed } : {}), ...(trustProxy ? { trustProxy } : {}), ...(host ? { host } : {}) });
console.log(`Round Table rooms: listening on port ${server.port}${host ? ` (${host})` : ''}. Rooms live in memory and end when this stops.`);

const stop = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
