import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { buildSteps, finalRoles, seatsAt } from '../../web/src/replay/timeline.js';
import { names, play, reply, rolesFor, scripted } from '../helpers/game.js';

const log = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(log);

describe('buildSteps', () => {
  it('has every turn once, in order, every event except speech and whispers, and a result last', () => {
    const turnIds = steps.flatMap((s) => (s.kind === 'turn' ? [s.turn.id] : []));
    expect(turnIds).toEqual(log.turns.map((t) => t.id));
    const events = steps.filter((s) => s.kind === 'event');
    expect(events).toHaveLength(log.events.filter((e) => e.type !== 'speech' && e.type !== 'whisper').length);
    expect(steps.at(-1)?.kind).toBe('result');
    expect(steps.filter((s) => s.kind === 'result')).toHaveLength(1);
  });

  it('puts each event right after the turn it follows', () => {
    steps.forEach((s, i) => {
      if (s.kind !== 'event') return;
      const prev = steps.slice(0, i).reverse().find((x) => x.kind === 'turn');
      expect(prev?.kind === 'turn' ? prev.turn.id : -1).toBe(s.event.afterTurn);
    });
  });

  it('labels sections with a round and a title', () => {
    const first = steps[0]!;
    expect(first.section).toEqual({ round: 1, title: 'Night' });
    const breakfast = steps.find((s) => s.kind === 'event' && s.event.type === 'breakfast')!;
    expect(breakfast.section).toEqual({ round: 1, title: 'Breakfast' });
    expect(steps.at(-1)?.section.title).toBe('Result');
    expect(steps.some((s) => s.section.title === 'Round table')).toBe(true);
  });
});

describe('seatsAt', () => {
  it('starts with everyone alive and no roles shown', () => {
    const seats = seatsAt(log, steps, 0);
    expect(seats).toHaveLength(8);
    expect(seats.every((s) => s.status === 'alive' && s.revealedRole === null)).toBe(true);
  });

  it('marks a victim and their role at breakfast, not at the murder step', () => {
    const murderIdx = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'murder');
    const breakfastIdx = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'breakfast');
    const victim = log.events.find((e) => e.type === 'breakfast')!;
    const name = victim.type === 'breakfast' ? (victim.victim as string) : '';
    expect(seatsAt(log, steps, murderIdx).find((s) => s.name === name)?.status).toBe('alive');
    const after = seatsAt(log, steps, breakfastIdx).find((s) => s.name === name)!;
    expect(after).toMatchObject({ status: 'murdered', revealedRole: log.roles[name] });
  });

  it('banishes with a role reveal and shows everyone at the result', () => {
    const banIdx = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'banishment');
    const ban = steps[banIdx]!;
    const who = ban.kind === 'event' && ban.event.type === 'banishment' ? ban.event.player : '';
    expect(seatsAt(log, steps, banIdx).find((s) => s.name === who)).toMatchObject({ status: 'banished' });
    const end = seatsAt(log, steps, steps.length - 1);
    expect(end.every((s) => s.revealedRole !== null)).toBe(true);
    expect(end.filter((s) => s.status === 'alive')).toHaveLength(log.result.survivors.length);
  });

  it('shows a recruit as a traitor only at the result', async () => {
    const roles = rolesFor(1);
    const traitors = names.filter((n) => roles[n] === 'traitor');
    const recruitLog = await play(
      scripted((req) => {
        if (req.phase === 'vote') {
          const t = traitors.find((x) => req.options.includes(x));
          return t ? reply({ target: t }) : undefined;
        }
        if (req.phase === 'recruit_choose') return reply({ target: req.options[0] });
        if (req.phase === 'recruit_respond') return reply({ accept: true });
        return undefined;
      }),
      1,
      { maxRounds: 2 },
    );
    const rec = recruitLog.events.find((e) => e.type === 'recruit');
    const target = rec?.type === 'recruit' ? rec.offeredTo : '';
    expect(finalRoles(recruitLog)[target]).toBe('traitor');
    const s = buildSteps(recruitLog);
    const mid = seatsAt(recruitLog, s, s.length - 2).find((x) => x.name === target)!;
    expect(mid.revealedRole === null || mid.status !== 'alive').toBe(true);
    expect(seatsAt(recruitLog, s, s.length - 1).find((x) => x.name === target)?.revealedRole).toBe('traitor');
  });
});

describe('buildSteps for a game still being played', () => {
  it('has no result step, and is otherwise the same steps', () => {
    const full = buildSteps(log);
    const partial = buildSteps(log, { partial: true });
    expect(full.at(-1)!.kind).toBe('result');
    expect(partial.some((s) => s.kind === 'result')).toBe(false);
    expect(partial).toEqual(full.slice(0, -1));
  });
});
