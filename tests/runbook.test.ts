import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EpisodeIndex } from '../src/log/episodes.js';

// The docs that name commands. If one names a command that is gone, or a link that goes nowhere, this fails.
const DOCS = ['README.md', 'docs/EPISODE.md', 'docs/POSTING.md', 'docs/DEPLOY.md', 'docs/ROOMS.md', 'docs/HIGHLIGHTS.md', 'docs/STATS.md'];
const read = (path: string): string => readFileSync(path, 'utf8');
const scripts = Object.keys((JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts);

/** GitHub's name for a heading's anchor: lower case, punctuation dropped, spaces to hyphens. */
const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
const anchorsOf = (path: string): Set<string> => new Set([...read(path).matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1] as string)));

describe('the docs match the code', () => {
  it('every `npm run` command a doc names is a script in package.json', () => {
    for (const doc of DOCS) {
      for (const m of read(doc).matchAll(/npm run ([\w:-]+)/g)) {
        expect(scripts, `${doc} names "npm run ${m[1]}"`).toContain(m[1]);
      }
    }
  });

  it('the README says what every script does', () => {
    const readme = read('README.md');
    for (const name of scripts) expect(readme, `README does not mention npm run ${name}`).toContain(`npm run ${name}`);
  });

  it('every link between the docs goes to a file that exists, and to a heading that exists', () => {
    for (const doc of DOCS) {
      for (const m of read(doc).matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1] as string;
        if (/^[a-z]+:/i.test(target)) continue; // an address on the web
        const [file, anchor] = target.split('#') as [string, string | undefined];
        const path = file === '' ? doc : join(dirname(doc), file);
        expect(existsSync(path), `${doc} links to ${target}, but ${path} is missing`).toBe(true);
        if (anchor && path.endsWith('.md')) expect(anchorsOf(path), `${doc} links to ${target}, but ${path} has no such heading`).toContain(anchor);
      }
    }
  });
});

describe('the runbook, on a mock game', () => {
  const SLOW = 180_000; // five tsx processes, which are slow when the whole suite runs in parallel
  const tsx = (script: string, ...args: string[]) => {
    const r = spawnSync('npx', ['tsx', `src/cli/${script}.ts`, ...args], { encoding: 'utf8' });
    expect(r.status, `${script} ${args.join(' ')}\n${r.stderr}`).toBe(0);
    return r.stdout;
  };

  it('runs games, prints a transcript, finds highlights, builds the episode list and the stats, as EPISODE.md says', () => {
    const work = mkdtempSync(join(tmpdir(), 'rt-runbook-'));
    const games = join(work, 'games');
    const published = join(work, 'public-games');
    mkdirSync(published);

    // 1. npm run games -- --mock --seeds 1-3
    const summary = tsx('games', '--mock', '--seeds', '1-3', '--out', games).trim().split('\n');
    expect(summary).toHaveLength(3);
    for (const [i, line] of summary.entries()) expect(line).toContain(`seed ${i + 1} |`);
    expect(readdirSync(games).sort()).toEqual(['mock-seed-1.json', 'mock-seed-2.json', 'mock-seed-3.json']);

    // 2. npm run transcript -- games/mock-seed-1.json
    const transcript = tsx('transcript', join(games, 'mock-seed-1.json'));
    expect(transcript).toContain('THE ROUND TABLE');
    expect(transcript).toContain('=== Result');

    // 3. npm run highlights -- games/mock-seed-1.json --limit 3 --name mock-seed-1  (every clip URL names the log)
    const highlights = JSON.parse(tsx('highlights', join(games, 'mock-seed-1.json'), '--json', '--limit', '3', '--name', 'mock-seed-1', '--base', 'https://example.org/show/')) as { url: string; from: number; to: number }[];
    expect(highlights.length).toBeGreaterThan(0);
    for (const h of highlights) {
      const url = new URL(h.url);
      expect(url.origin + url.pathname).toBe('https://example.org/show/');
      expect(url.searchParams.get('mode')).toBe('record');
      expect(url.searchParams.get('log')).toBe('mock-seed-1');
      expect(Number(url.searchParams.get('from'))).toBe(h.from);
    }

    // 4. cp ... web/public/games/episode-00N.json, then npm run episodes -- web/public/games
    for (const n of [1, 2, 3]) copyFileSync(join(games, `mock-seed-${n}.json`), join(published, `episode-00${n}.json`));
    expect(tsx('episodes', published).trim()).toBe(join(published, 'index.json'));
    const index = JSON.parse(read(join(published, 'index.json'))) as EpisodeIndex;
    expect(index.episodes.map((e) => [e.number, e.name])).toEqual([[1, 'episode-001'], [2, 'episode-002'], [3, 'episode-003']]);
    // The list gives nothing away: the number of traitors is what the viewer is told to find, and there is no winner, role or name.
    for (const e of index.episodes) expect(Object.keys(e).sort()).toEqual(['name', 'number', 'players', 'rounds', 'traitors']);
    expect(JSON.stringify(index)).not.toMatch(/winner|role|Aria|Bram|Cleo/);

    // 5. npm run stats -- games --out web/public/stats.json
    const statsFile = join(work, 'stats.json');
    tsx('stats', games, '--out', statsFile);
    const stats = JSON.parse(read(statsFile)) as { games: number; models: { model: string }[] };
    expect(stats.games).toBe(3);
    expect(stats.models.map((m) => m.model)).toEqual(['mock']);

    // The same seeds give the same games, so the rehearsal is repeatable.
    const again = join(work, 'again');
    tsx('games', '--mock', '--seeds', '1', '--out', again);
    expect(read(join(again, 'mock-seed-1.json'))).toBe(read(join(games, 'mock-seed-1.json')));
    expect(resolve(work)).toContain('rt-runbook-');
  }, SLOW);
});
