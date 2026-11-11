import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { writeGameLog } from '../../src/log/writer.js';
import { playMock } from '../helpers/game.js';

let logPath = '';
beforeAll(async () => {
  logPath = writeGameLog(await playMock(1), mkdtempSync(join(tmpdir(), 'rt-hl-')), 'mock-seed-1');
});

const run = (...args: string[]) => spawnSync('npx', ['tsx', 'src/cli/highlights.ts', ...args], { encoding: 'utf8' });

describe('npm run highlights', () => {
  it('prints ranked text with recording URLs for the log name taken from the file name', () => {
    const r = run(logPath);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^#1 {2}\[\d+\] /);
    expect(r.stdout).toContain('final reveal');
    expect(r.stdout).toContain('http://localhost:5173/?mode=record&log=mock-seed-1&from=');
  });

  it('prints JSON with --json and respects --limit, --base, --name and --aspect', () => {
    const r = run(logPath, '--json', '--limit', '1', '--base', 'http://example.test/', '--name', 'ep1', '--aspect', '9x16');
    expect(r.status).toBe(0);
    const items = JSON.parse(r.stdout) as { rank: number; url: string }[];
    expect(items).toHaveLength(1);
    expect(items[0]!.rank).toBe(1);
    const url = new URL(items[0]!.url);
    expect(url.origin).toBe('http://example.test');
    expect(url.searchParams.get('log')).toBe('ep1');
    expect(url.searchParams.get('aspect')).toBe('9x16');
  });

  it('exits 1 with a message for bad arguments, a missing file and a wrong log', () => {
    const cases: [string[], string][] = [
      [[], 'usage:'],
      [[logPath, '--limit', 'x'], '--limit must be'],
      [[logPath, '--aspect', '4x3'], '--aspect must be'],
      [[logPath, '--base', 'nope'], '--base must be a full http or https URL'],
      [[logPath, '--base', 'localhost:5173/'], '--base must be a full http or https URL'],
      [[logPath, '--base', 'javascript:alert(1)'], '--base must be a full http or https URL'],
      [[logPath, '--limit', ''], '--limit must be a whole number'],
      [[logPath, '--limit', ' '], '--limit must be a whole number'],
      [[logPath, '--limit', '1.5'], '--limit must be a whole number'],
      [[logPath, '--name', '../x'], 'not a plain log name'],
      [[join(tmpdir(), 'does-not-exist.json')], 'ENOENT'],
    ];
    for (const [args, why] of cases) {
      const r = run(...args);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stderr, args.join(' ')).toContain(why);
    }
  });
});
