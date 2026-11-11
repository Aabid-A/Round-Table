import { describe, expect, it } from 'vitest';
import { buildEpisodeIndex } from '../../src/log/episodes.js';
import { playMock } from '../helpers/game.js';

describe('buildEpisodeIndex', () => {
  it('numbers episodes from 1 in the order given and records players, traitors and rounds', async () => {
    const [a, b] = await Promise.all([playMock(1), playMock(2)]);
    const { index, skipped } = buildEpisodeIndex([{ name: 'ep-1', log: a }, { name: 'ep-2', log: b }]);
    expect(skipped).toEqual([]);
    expect(index).toEqual({
      indexVersion: 1,
      episodes: [
        { number: 1, name: 'ep-1', players: 8, traitors: 2, rounds: a.result.rounds },
        { number: 2, name: 'ep-2', players: 8, traitors: 2, rounds: b.result.rounds },
      ],
    });
  });

  it('holds no spoilers: no winner, roles or reason anywhere in the index', async () => {
    const log = await playMock(3);
    const json = JSON.stringify(buildEpisodeIndex([{ name: 'ep', log }]).index);
    for (const word of ['winner', 'traitor"', 'faithful', 'reason', 'roles', 'survivors']) expect(json, word).not.toContain(word);
  });

  it('leaves out a log whose name is not a plain file name and keeps numbering gap-free', async () => {
    const log = await playMock(1);
    const { index, skipped } = buildEpisodeIndex([{ name: 'a b', log }, { name: 'ok', log }, { name: '../x', log }, { name: 'ok2', log }]);
    expect(skipped).toEqual(['a b', '../x']);
    expect(index.episodes.map((e) => [e.number, e.name])).toEqual([[1, 'ok'], [2, 'ok2']]);
  });
});
