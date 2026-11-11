import { startServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be a whole number from 0 to 65535.');
  process.exit(1);
}
const host = process.env.HOST;

const server = await startServer({ port, ...(host ? { host } : {}) });
console.log(`Round Table rooms: listening on port ${server.port}${host ? ` (${host})` : ''}. Rooms live in memory and end when this stops.`);

const stop = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
