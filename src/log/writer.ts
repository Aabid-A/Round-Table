import { accessSync, constants, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameLog } from '../engine/types.js';
import { redactLog } from '../players/scrub.js';

/** Create the folder and check it is writable, so a long run does not discover a bad path at the end. */
export function ensureWritableDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  accessSync(dir, constants.W_OK);
}

export function serializeLog(log: GameLog): string {
  return `${JSON.stringify(log, null, 2)}\n`;
}

/** Write games/<name>.json (or another dir) and return the path. Every copy of a secret is masked first. */
export function writeGameLog(log: GameLog, dir: string, name: string, secrets: readonly string[] = []): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  writeFileSync(path, serializeLog(redactLog(log, secrets)));
  return path;
}

export function readGameLog(path: string): GameLog {
  const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const log = data as Partial<GameLog> | null;
  if (!log || log.schemaVersion !== 1) throw new Error(`${path}: unsupported log (expected schemaVersion 1)`);
  if (!Array.isArray(log.turns) || !Array.isArray(log.events) || !log.result || !Array.isArray(log.cast)) {
    throw new Error(`${path}: not a valid game log`);
  }
  return log as GameLog;
}
