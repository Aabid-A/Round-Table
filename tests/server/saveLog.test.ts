import { mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roomLogName } from '../../src/roomCode.js';
import { parseGameLog } from '../../web/src/replay/parse.js';
import { saveLog } from '../../server/saveLog.js';
import { logFrom } from '../helpers/logs.js';

const log = logFrom({ Aria: 'traitor', Bram: 'faithful' }, []);

describe('roomLogName', () => {
  it('is the room code and the seed, and a plain name the replay page accepts', () => {
    expect(roomLogName('AB2CD', 42)).toBe('room-AB2CD-seed-42');
    expect(roomLogName('AB2CD', 42)).toMatch(/^[\w.-]+$/);
  });
});

describe('saveLog', () => {
  it('writes a log the replay page can read, creating the folder, and leaves no temporary file', async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'rt-logs-')), 'nested', 'games');
    const path = await saveLog(dir, 'room-AB2CD-seed-1', log);
    expect(path).toBe(join(dir, 'room-AB2CD-seed-1.json'));
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(log);
    expect(parseGameLog(await readFile(path, 'utf8')).ok).toBe(true);
    expect(await readdir(dir)).toEqual(['room-AB2CD-seed-1.json']);
  });

  it('replaces an earlier file of the same name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rt-logs-'));
    await saveLog(dir, 'a', log);
    await saveLog(dir, 'a', { ...log, seed: 99 });
    expect(JSON.parse(await readFile(join(dir, 'a.json'), 'utf8')).seed).toBe(99);
  });

  it('leaves no temporary file behind when the write fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rt-logs-'));
    await mkdir(join(dir, 'a.json')); // a folder where the file should go, so the final rename fails
    await expect(saveLog(dir, 'a', log)).rejects.toThrow();
    expect(await readdir(dir)).toEqual(['a.json']); // only that folder: no .a.json.tmp
  });

  it('refuses a name that could leave the folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rt-logs-'));
    for (const bad of ['../x', 'a/b', '..', 'a..b', '', 'a b', '/etc/passwd']) await expect(saveLog(dir, bad, log), bad).rejects.toThrow('log name is not plain');
    expect(await readdir(dir)).toEqual([]);
  });
});
