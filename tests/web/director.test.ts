import { describe, expect, it } from 'vitest';
import { buildContext, type Context } from '../../src/log/highlights/context.js';
import type { GameLog } from '../../src/engine/types.js';
import { directorShot } from '../../web/src/perspective/director.js';
import { buildSteps } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

const turnStep = (log: GameLog, phase: string) => {
  const steps = buildSteps(log);
  return steps.find((s) => s.kind === 'turn' && s.turn.phase === phase)!;
};

describe('directorShot', () => {
  it('cuts to whoever acts, and pulls wide for votes, reveals and the result', async () => {
    const log = await playMock(3);
    const ctx = buildContext(log);
    const steps = buildSteps(log);
    for (const step of steps) {
      const shot = directorShot(ctx, step);
      if (step.kind === 'turn' && ['night', 'whispers', 'recruit_choose', 'recruit_respond'].includes(step.turn.phase)) expect(shot).toEqual({ focus: step.turn.player, wide: false, reason: 'speaker' });
      if (step.kind !== 'turn' || ['vote', 'revote', 'endgame_vote'].includes(step.turn.phase)) expect(shot).toEqual({ focus: null, wide: true, reason: 'wide' });
    }
    expect(steps.at(-1)!.kind).toBe('result');
  });

  it('holds on a traitor while a player they targeted at night speaks', async () => {
    const log = await playMock(3);
    const step = turnStep(log, 'round_table');
    const turn = (step as { turn: { id: number; player: string; round: number } }).turn;
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor' && c.name !== turn.player)!.name;
    const ctx: Context = { ...buildContext(log), nightTargets: (t) => (t === traitor ? new Map([[turn.player, turn.round]]) : new Map()), isOutAt: () => false };
    expect(directorShot(ctx, step)).toEqual({ focus: traitor, wide: false, reason: 'traitor_hold' });
  });

  it('holds on a traitor who named the speaker as their suspect earlier at the table', async () => {
    const log = await playMock(3);
    const talks = log.turns.filter((t) => t.phase === 'round_table' && t.round === 1);
    const second = talks[1]!;
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor' && c.name !== second.player && c.name !== talks[0]!.player)!.name;
    // Make an earlier speech by a traitor name the later speaker as the suspect.
    const edited: GameLog = { ...log, turns: log.turns.map((t) => (t.id === talks[0]!.id ? { ...t, player: traitor, action: { suspect: second.player, reason: 'x' } } : t)) };
    const ctx: Context = { ...buildContext(edited), nightTargets: () => new Map() };
    const step = buildSteps(edited).find((s) => s.kind === 'turn' && s.turn.id === second.id)!;
    expect(directorShot(ctx, step)).toEqual({ focus: traitor, wide: false, reason: 'traitor_hold' });
  });

  it('does not hold on a traitor who has left the table, or on the speaker themself', async () => {
    const log = await playMock(3);
    const step = turnStep(log, 'round_table');
    const turn = (step as { turn: { player: string; round: number } }).turn;
    const everyoneTargets: Context = { ...buildContext(log), nightTargets: () => new Map([[turn.player, turn.round]]) };
    const gone: Context = { ...everyoneTargets, isOutAt: () => true };
    expect(directorShot(gone, step).reason).toBe('speaker');
    const self: Context = { ...everyoneTargets, isTraitorAt: (p) => p === turn.player, isOutAt: () => false };
    expect(directorShot(self, step).reason).toBe('speaker');
  });
});
