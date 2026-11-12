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

  /** A round-table step at `round`, with everything else in the log left as it was. */
  const firstTalk = (log: GameLog, round: number) => log.turns.find((t) => t.phase === 'round_table' && t.round === round)!;
  const edit = (log: GameLog, id: number, change: object): GameLog => ({ ...log, turns: log.turns.map((t) => (t.id === id ? { ...t, ...change } : t)) });
  const stepOf = (log: GameLog, id: number) => buildSteps(log).find((s) => s.kind === 'turn' && s.turn.id === id)!;

  it('holds on a traitor whose night choice this round was the speaker, and not for a night choice from an earlier round', async () => {
    const log = await playMock(3);
    const talk = firstTalk(log, 2);
    const traitors = log.cast.filter((c) => log.roles[c.name] === 'traitor' && c.name !== talk.player).map((c) => c.name);
    const traitor = traitors[0]!;
    const elsewhere = log.cast.find((c) => c.name !== talk.player && !traitors.includes(c.name))!.name;
    // Every traitor's night choice and every suspect goes somewhere else, then one of them chooses the speaker in the round asked for.
    const base: GameLog = {
      ...log,
      turns: log.turns.map((t) => (t.phase === 'night' ? { ...t, action: { target: elsewhere } } : t.phase === 'round_table' ? { ...t, action: { suspect: elsewhere, reason: 'x' } } : t)),
    };
    // A traitor takes two night turns when the pack disagrees, so change all of theirs in the round.
    const choose = (round: number): GameLog => ({ ...base, turns: base.turns.map((t) => (t.phase === 'night' && t.round === round && t.player === traitor ? { ...t, action: { target: talk.player } } : t)) });
    const targetedNow = choose(2);
    expect(directorShot(buildContext(targetedNow), stepOf(targetedNow, talk.id))).toEqual({ focus: traitor, wide: false, reason: 'traitor_hold' });
    const targetedBefore = choose(1);
    expect(directorShot(buildContext(targetedBefore), stepOf(targetedBefore, talk.id)).reason).toBe('speaker');
  });

  it('holds on a traitor who named the speaker as their suspect earlier this round, and not one from an earlier round', async () => {
    const log = await playMock(3);
    const talks = log.turns.filter((t) => t.phase === 'round_table' && t.round === 1);
    const second = talks[1]!;
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor' && c.name !== second.player && c.name !== talks[0]!.player)!.name;
    const framing = { player: traitor, action: { suspect: second.player, reason: 'x' } };
    const framed = edit(log, talks[0]!.id, framing);
    expect(directorShot(buildContext(framed), stepOf(framed, second.id))).toEqual({ focus: traitor, wide: false, reason: 'traitor_hold' });
    // The same framing, one round later, is old news when the speaker talks in round 2.
    const later = log.turns.find((t) => t.phase === 'round_table' && t.round === 2 && t.player === second.player);
    expect(later).toBeDefined();
    expect(directorShot(buildContext(framed), stepOf(framed, later!.id)).reason).toBe('speaker');
  });

  it('does not hold on a traitor who has left the table, or on the speaker themself', async () => {
    const log = await playMock(3);
    const step = turnStep(log, 'round_table');
    const turn = (step as { turn: { player: string; round: number } }).turn;
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor' && c.name !== turn.player)!.name;
    const targeted: GameLog = { ...log, turns: log.turns.map((t) => (t.phase === 'night' && t.round === turn.round && t.player === traitor ? { ...t, action: { target: turn.player } } : t)) };
    const ctx = buildContext(targeted);
    expect(directorShot(ctx, step).reason).toBe('traitor_hold');
    const gone: Context = { ...ctx, isOutAt: () => true };
    expect(directorShot(gone, step).reason).toBe('speaker');
    const self: Context = { ...ctx, isTraitorAt: (p) => p === turn.player, isOutAt: () => false };
    expect(directorShot(self, step).reason).toBe('speaker');
  });
});
