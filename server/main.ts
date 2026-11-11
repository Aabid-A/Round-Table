import { msFromEnv } from './config.js';
import { startServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be a whole number from 0 to 65535.');
  process.exit(1);
}
const host = process.env.HOST;

let turnMs: number;
let abandonMs: number;
try {
  turnMs = msFromEnv(process.env, 'TURN_MS', 90_000);
  abandonMs = msFromEnv(process.env, 'ABANDON_MS', 2 * 60_000);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const allowSeed = process.env.ALLOW_SEED === '1';
if (allowSeed) console.warn('ALLOW_SEED=1: pages can choose a room\'s seed, which decides every role. Use this for tests only.');

const server = await startServer({ port, turnMs, abandonMs, ...(allowSeed ? { allowSeed } : {}), ...(host ? { host } : {}) });
console.log(`Round Table rooms: listening on port ${server.port}${host ? ` (${host})` : ''}. Rooms live in memory and end when this stops.`);

const stop = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
