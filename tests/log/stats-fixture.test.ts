import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { computeStats } from '../../src/log/stats.js';
import { game1, game2 } from '../helpers/season.js';

const FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'sample-stats.json');

it('regenerates tests/fixtures/sample-stats.json from the code', () => {
  const stats = computeStats([game1(), game2()]);
  // Numbers worked out by hand from game1 and game2 (see tests/helpers/season.ts), so a wrong computeStats fails here
  // instead of silently rewriting the fixture.
  expect(stats.models.map((m) => [m.model, m.games, m.betrayalIndex, m.caughtAsTraitor, m.faithfulsBanishedByTraitorVote, m.recruitOffersAccepted])).toEqual([
    ['model-b', 1, 2, 1, 1, 0],
    ['model-a', 2, 1, 1, 1, 0],
    ['model-c', 3, 0.67, 0, 0, 1],
    ['model-d', 2, 0, 0, 0, 0],
  ]);
  const text = `${JSON.stringify(stats, null, 2)}\n`;
  writeFileSync(FIXTURE, text);
  expect(readFileSync(FIXTURE, 'utf8')).toBe(text);
  expect(stats.models.map((m) => m.model)).toEqual(['model-b', 'model-a', 'model-c', 'model-d']);
});
