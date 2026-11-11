import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GameLog } from '../src/engine/types.js';

/**
 * Write a finished game's log as `<dir>/<name>.json`, the same format the command line saves, so replay, highlights, cards and stats work
 * on it. Written to a temporary file and renamed, so a reader never sees half a file. The name must be plain (letters, digits, dot,
 * dash, underscore), so it cannot point outside the folder. Returns the path.
 */
export async function saveLog(dir: string, name: string, log: GameLog): Promise<string> {
  if (!/^[\w.-]+$/.test(name) || name.includes('..')) throw new Error('log name is not plain');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  const temp = join(dir, `.${name}.json.tmp`);
  try {
    await writeFile(temp, `${JSON.stringify(log, null, 2)}\n`);
    await rename(temp, path);
  } catch (e) {
    await rm(temp, { force: true }); // do not leave a half-written file behind
    throw e;
  }
  return path;
}
