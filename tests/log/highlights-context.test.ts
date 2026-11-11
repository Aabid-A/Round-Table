import { describe, expect, it } from 'vitest';
import { buildContext } from '../../src/log/highlights/context.js';
import { logFrom } from '../helpers/logs.js';

const roles = { T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful' } as const;

const log = logFrom({ ...roles }, [
  { r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } },
  { r: 1, phase: 'night', p: 'T2', action: { target: 'F2' } },
  { r: 1, ev: { type: 'murder', victim: 'F1', proposals: [], method: 'random' } },
  { r: 1, ev: { type: 'breakfast', victim: 'F1', role: 'faithful' } },
  { r: 1, phase: 'vote', p: 'F2', action: { target: 'T2' } },
  { r: 1, phase: 'vote', p: 'F3', action: { target: 'T2' } },
  { r: 1, ev: { type: 'banishment', player: 'T2', role: 'traitor', method: 'majority' } },
  { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: true } },
  { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: true } },
  { r: 2, phase: 'night', p: 'F3', action: { target: 'F2' } },
]);

describe('buildContext', () => {
  const c = buildContext(log);

  it('knows who is a traitor at a given turn, counting a recruit from the next turn', () => {
    expect(c.isTraitorAt('T1', 0)).toBe(true);
    expect(c.isTraitorAt('F2', 0)).toBe(false);
    const respond = log.turns.find((t) => t.phase === 'recruit_respond')!.id;
    expect(c.isTraitorAt('F3', respond)).toBe(false);
    expect(c.isTraitorAt('F3', respond + 1)).toBe(true);
  });

  it('knows who is out before a turn: a victim from breakfast, a banished player after the banishment', () => {
    expect(c.isOutAt('F1', 0)).toBe(false);
    expect(c.isOutAt('F1', 2)).toBe(true);
    expect(c.isOutAt('T2', 3)).toBe(false);
    expect(c.isOutAt('T2', 4)).toBe(true);
  });

  it('collects the night proposals of a traitor up to a round', () => {
    expect([...c.nightTargets('T1', 1)]).toEqual(['F1']);
    expect([...c.nightTargets('F3', 1)]).toEqual([]);
    expect([...c.nightTargets('F3', 2)]).toEqual(['F2']);
  });

  it('finds turns and events', () => {
    expect(c.stageTurns(1, 'vote').map((t) => t.player)).toEqual(['F2', 'F3']);
    expect(c.events('banishment')).toHaveLength(1);
    expect(c.turnById(0)?.player).toBe('T1');
    expect(c.turnById(99)).toBeUndefined();
  });
});
