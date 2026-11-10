import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGameLog, serializeLog, writeGameLog } from '../../src/log/writer.js';
import { renderTranscript } from '../../src/log/transcript.js';
import { playMock } from '../helpers/game.js';
import { writeFileSync } from 'node:fs';

const FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'sample-game.json');

describe('transcript', () => {
  it('puts private notes under each turn, marked as hidden from players', async () => {
    const log = await playMock(1);
    const lines = renderTranscript(log).split('\n');
    let checked = 0;
    for (const t of log.turns) {
      const i = lines.findIndex((l) => l.includes(t.private_notes));
      expect(i, `turn ${t.id}`).toBeGreaterThan(0);
      expect(lines[i]).toContain('[HIDDEN FROM PLAYERS]');
      checked++;
    }
    expect(checked).toBe(log.turns.length);
    const rt = log.turns.find((t) => t.phase === 'round_table')!;
    const at = lines.findIndex((l) => l.includes(rt.speech));
    expect(lines[at + 2]).toContain(rt.private_notes);
    expect(renderTranscript(log)).toContain('Result:');
  });

  it('flags fallback turns', async () => {
    const log = await playMock(1);
    const t = log.turns[0]!;
    t.fallback = true;
    expect(renderTranscript(log)).toContain('[FALLBACK');
  });
});

describe('log files', () => {
  it('round-trips through the writer and reader', async () => {
    const log = await playMock(2);
    const dir = mkdtempSync(join(tmpdir(), 'rt-log-'));
    const path = writeGameLog(log, join(dir, 'nested'), 'g');
    expect(path.endsWith('g.json')).toBe(true);
    expect(readGameLog(path)).toEqual(log);
  });

  it('rejects an unsupported schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-log-'));
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'bad.json');
    writeFileSync(p, JSON.stringify({ schemaVersion: 2 }));
    expect(() => readGameLog(p)).toThrow('schemaVersion 1');
  });

  it('regenerates tests/fixtures/sample-game.json from the code', async () => {
    const log = await playMock(1);
    writeFileSync(FIXTURE, serializeLog(log));
    const onDisk = readGameLog(FIXTURE);
    expect(onDisk).toEqual(log);
    expect(readFileSync(FIXTURE, 'utf8')).toBe(serializeLog(log));
    expect(onDisk.schemaVersion).toBe(1);
  });
});
