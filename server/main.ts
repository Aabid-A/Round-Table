import { countFromEnv, msFromEnv, parseOrigins, positiveFromEnv } from './config.js';
import { startServer } from './server.js';

let port: number;
try {
  // An empty PORT counts as unset (it used to become 0, a random port). 0 is not offered: a deployment needs a port it can name.
  port = countFromEnv(process.env, 'PORT', 8787, 1, 65535);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const host = process.env.HOST;

let turnMs: number;
let abandonMs: number;
let maxRooms: number;
let maxConnections: number;
let allowedOrigins: string[] | undefined;
let costFloorUsd: number | undefined;
try {
  turnMs = msFromEnv(process.env, 'TURN_MS', 90_000);
  abandonMs = msFromEnv(process.env, 'ABANDON_MS', 2 * 60_000);
  maxRooms = countFromEnv(process.env, 'MAX_ROOMS_PER_ADDRESS', 3);
  maxConnections = countFromEnv(process.env, 'MAX_CONNECTIONS_PER_ADDRESS', 20);
  allowedOrigins = parseOrigins(process.env);
  costFloorUsd = positiveFromEnv(process.env, 'COST_FLOOR_USD', undefined);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const allowSeed = process.env.ALLOW_SEED === '1';
if (allowSeed) console.warn('ALLOW_SEED=1: pages can choose a room\'s seed, which decides every role. Use this for tests only.');

const trustProxy = process.env.TRUST_PROXY === '1';
// Finished games are saved here as normal logs (replay, highlights, cards and stats read them). LOG_DIR=none turns saving off.
const logDir = process.env.LOG_DIR === 'none' ? undefined : (process.env.LOG_DIR ?? 'games');

const server = await startServer({ port, turnMs, abandonMs, maxRoomsPerAddress: maxRooms, maxConnectionsPerAddress: maxConnections, ...(allowSeed ? { allowSeed } : {}), ...(trustProxy ? { trustProxy } : {}), ...(allowedOrigins ? { allowedOrigins } : {}), ...(costFloorUsd !== undefined ? { costFloorUsd } : {}), ...(logDir !== undefined ? { logDir } : {}), ...(host ? { host } : {}) });
console.log(`Round Table rooms: listening on port ${server.port}${host ? ` (${host})` : ''}. Rooms live in memory and end when this stops.`);
console.log(allowedOrigins ? `Only these origins may connect: ${allowedOrigins.join(', ')}.` : 'Any origin may connect (set ALLOWED_ORIGINS to restrict this).');
console.log(logDir === undefined ? 'Game logs are not saved (LOG_DIR=none).' : `Finished games are saved as logs in ${logDir}/.`);

const stop = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
