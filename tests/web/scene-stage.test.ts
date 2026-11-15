import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { SEES_ALL, seatSight, stageAt } from '../../web/src/perspective/stage.js';
import { buildSteps } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(sample);
const find = (pred: (s: (typeof steps)[number]) => boolean): number => steps.findIndex(pred);

describe('the moments the room stages', () => {
  it('stages breakfast as dawn on the victim, and a banishment with the votes that caused it', () => {
    const b = find((s) => s.kind === 'event' && s.event.type === 'breakfast' && s.event.victim !== null);
    expect(stageAt(sample, steps, b, SEES_ALL)).toMatchObject({ kind: 'dawn' });
    const ban = find((s) => s.kind === 'event' && s.event.type === 'banishment');
    const stage = stageAt(sample, steps, ban, SEES_ALL);
    expect(stage).toMatchObject({ kind: 'banish' });
    expect(stage?.kind === 'banish' && stage.votes.length).toBeGreaterThan(0);
  });

  it('lays a token for each vote cast so far at the public table', () => {
    const votes = steps.map((s, i) => [s, i] as const).filter(([s]) => s.kind === 'turn' && s.turn.phase === 'vote' && s.turn.round === 1);
    const counts = votes.map(([, i]) => {
      const st = stageAt(sample, steps, i, SEES_ALL);
      return st?.kind === 'votes' ? st.votes.length : 0;
    });
    expect(counts).toEqual(counts.map((_, k) => k + 1));
  });

  it('shows a seat its own vote only, until the votes are counted for all to see', () => {
    const votes = steps.map((s, i) => [s, i] as const).filter(([s]) => s.kind === 'turn' && s.turn.phase === 'vote' && s.turn.round === 1);
    const [first] = votes[0]!;
    const voter = first.kind === 'turn' ? first.turn.player : '';
    const someoneElse = sample.cast.find((c) => c.name !== voter)!.name;
    expect(stageAt(sample, steps, votes[0]![1], seatSight(someoneElse))).toBeNull();
    expect(stageAt(sample, steps, votes[0]![1], seatSight(voter))).toEqual({ kind: 'votes', votes: [{ voter, target: expect.any(String) }] });
  });

  it('never stages a recruitment for a seat that was not part of it', async () => {
    let seen = 0;
    for (const log of [sample, ...(await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((s) => playMock(s))))]) {
      const st = buildSteps(log);
      st.forEach((s, i) => {
        if (s.kind !== 'event' || s.event.type !== 'recruit') return;
        const e = s.event;
        for (const c of log.cast) {
          const got = stageAt(log, st, i, seatSight(c.name));
          if (c.name === e.offeredBy || c.name === e.offeredTo) expect(got).toEqual({ kind: 'recruit', from: e.offeredBy, to: e.offeredTo });
          else expect(got, c.name).toBeNull();
          seen++;
        }
      });
    }
    expect(seen).toBeGreaterThan(0);
  });
});
