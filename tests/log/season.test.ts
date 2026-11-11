import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSeason } from '../../src/log/season.js';
import { writeGameLog } from '../../src/log/writer.js';
import { playMock } from '../helpers/game.js';

describe('readSeason', () => {
  it('reads the logs in a folder in file name order and skips bad files with a reason', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-season-'));
    writeGameLog(await playMock(2), dir, 'b-game');
    writeGameLog(await playMock(1), dir, 'a-game');
    writeFileSync(join(dir, 'broken.json'), '{nope');
    writeFileSync(join(dir, 'old.json'), JSON.stringify({ schemaVersion: 2 }));
    writeFileSync(join(dir, 'notes.txt'), 'not a log');
    mkdirSync(join(dir, 'sub.json')); // a folder named like a log
    const season = readSeason(dir);
    expect(season.logs.map((l) => l.seed)).toEqual([1, 2]);
    expect(season.skipped.map((s) => s.file)).toEqual(['broken.json', 'old.json', 'sub.json']);
    expect(season.skipped[1]!.reason).toContain('schemaVersion 1');
  });

  it('is empty for an empty folder and throws for a missing one', () => {
    expect(readSeason(mkdtempSync(join(tmpdir(), 'rt-season-')))).toEqual({ logs: [], skipped: [] });
    expect(() => readSeason(join(tmpdir(), 'rt-no-such-folder'))).toThrow();
  });
});
