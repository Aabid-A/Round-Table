import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { computeStats } from '../../src/log/stats.js';
import { game1, game2 } from '../helpers/season.js';

const FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'sample-stats.json');

it('regenerates tests/fixtures/sample-stats.json from the code', () => {
  const stats = computeStats([game1(), game2()]);
  const text = `${JSON.stringify(stats, null, 2)}\n`;
  writeFileSync(FIXTURE, text);
  expect(readFileSync(FIXTURE, 'utf8')).toBe(text);
  expect(stats.models.map((m) => m.model)).toEqual(['model-b', 'model-a', 'model-c', 'model-d']);
});
