import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { positionAtOrBefore, seatTimeline, seatView } from '../../web/src/perspective/seatView.js';
import { buildSteps, finalRoles } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;

/** Every moment of every seat's view, for the seats the test names. */
function* views(log: GameLog, who: (name: string) => boolean) {
  const steps = buildSteps(log);
  for (const c of log.cast) {
    if (!who(c.name)) continue;
    for (let i = 0; i < steps.length; i++) yield { seat: c.name, i, view: seatView(log, steps, i, c.name), json: JSON.stringify(seatView(log, steps, i, c.name)) };
  }
}

describe('a faithful’s view', () => {
  const logs = async (): Promise<GameLog[]> => [sample, ...(await Promise.all([1, 2, 3, 4, 5, 6].map((s) => playMock(s))))];

  it('never names a traitor who is still hidden, at any moment, in any of 7 games', async () => {
    let checked = 0;
    for (const log of await logs()) {
      for (const { seat, i, view } of views(log, (n) => finalRoles(log)[n] === 'faithful')) {
        for (const s of view.seats) {
          if (s.name === seat) continue;
          // A seat that stays faithful all game is never told a hidden role. Another seat may show a role only once it is out of the game, where the game itself revealed it.
          if (s.role !== null) expect(s.status, `${seat} step ${i}: ${s.name}`).not.toBe('alive');
          expect(s.mark, `${seat} step ${i}`).not.toBe('fellow');
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('never contains another player’s private notes', async () => {
    for (const log of await logs()) {
      const notesOf = (name: string): string[] => log.turns.filter((t) => t.player !== name && t.private_notes.trim() !== '').map((t) => t.private_notes);
      for (const { seat, i, json } of views(log, (n) => finalRoles(log)[n] === 'faithful')) {
        for (const note of notesOf(seat)) expect(json.includes(JSON.stringify(note).slice(1, -1)), `${seat} step ${i} shows a note`).toBe(false);
      }
    }
  });

  it('never contains a whisper they were not part of, and does show the ones they were', async () => {
    for (const log of await logs()) {
      const whispers = log.events.filter((e): e is Extract<typeof e, { type: 'whisper' }> => e.type === 'whisper');
      for (const { seat, i, json } of views(log, (n) => finalRoles(log)[n] === 'faithful')) {
        for (const w of whispers) {
          const text = JSON.stringify(w.message).slice(1, -1);
          if (w.from !== seat && w.to !== seat) expect(json.includes(text), `${seat} step ${i} sees a whisper between ${w.from} and ${w.to}`).toBe(false);
        }
      }
    }
    // The positive side, on one game: a whisper to a faithful appears in their view after it was sent.
    const log = await playMock(2);
    const steps = buildSteps(log);
    const w = log.events.find((e) => e.type === 'whisper' && log.roles[e.to] === 'faithful')!;
    const to = (w as { to: string }).to;
    const msg = (w as { message: string }).message;
    const seen = steps.some((_, i) => JSON.stringify(seatView(log, steps, i, to)).includes(JSON.stringify(msg).slice(1, -1)));
    expect(seen).toBe(true);
  });

  it('has only what their own prompts told them: nothing before their first turn', () => {
    const steps = buildSteps(sample);
    const name = sample.cast.find((c) => sample.roles[c.name] === 'faithful')!.name;
    const view = seatView(sample, steps, 0, name);
    expect(view.seats.every((s) => s.role === null || s.mark === 'self')).toBe(true);
  });
});

describe('a traitor’s view', () => {
  it('shows their fellow traitor, and no other hidden role', async () => {
    const log = await playMock(1);
    const steps = buildSteps(log);
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor')!.name;
    const last = steps.length - 1;
    const view = seatView(log, steps, last, traitor);
    const self = view.seats.find((s) => s.name === traitor)!;
    expect(self.role).toBe('traitor');
    for (const s of view.seats) if (s.mark === 'fellow') expect(log.roles[s.name]).toBe('traitor');
    for (const s of view.seats) if (s.status === 'alive' && s.mark === null) expect(s.role).toBeNull();
  });
});

describe('what a seat is told, and when', () => {
  const whisperTurns = (log: GameLog) => log.turns.filter((t) => t.phase === 'whispers' && typeof (t.action as { to?: unknown }).to === 'string' && ((t.action as { message?: string }).message ?? '').length > 8);

  it('a whisper reaches its recipient when the whisper phase ends, not when it was typed', async () => {
    const log = await playMock(2);
    const steps = buildSteps(log);
    let checked = 0;
    for (const w of whisperTurns(log)) {
      const to = (w.action as { to: string }).to;
      const message = JSON.stringify((w.action as { message: string }).message).slice(1, -1);
      const stepIndex = steps.findIndex((s) => s.kind === 'turn' && s.turn.id === w.id);
      const lastOfRound = steps.filter((s) => s.kind === 'turn' && s.turn.phase === 'whispers' && s.turn.round === w.round).at(-1)!;
      const deliveredAt = steps.indexOf(lastOfRound);
      for (let i = 0; i < steps.length; i++) {
        const shown = JSON.stringify(seatView(log, steps, i, to)).includes(message); // the whole view, not just the moment
        if (i < deliveredAt) expect(shown, `whisper to ${to} shown at step ${i}, before ${deliveredAt}`).toBe(false);
      }
      expect(JSON.stringify(seatView(log, steps, deliveredAt, to))).toContain(message);
      expect(stepIndex).toBeLessThanOrEqual(deliveredAt);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('a recruitment offer is not even named to a seat that is not part of it', async () => {
    let found = 0;
    for (let seed = 1; seed <= 40 && found < 3; seed++) {
      const log = await playMock(seed);
      const steps = buildSteps(log);
      const offers = log.events.filter((e) => e.type === 'recruit');
      if (offers.length === 0) continue;
      found++;
      for (const o of offers as { offeredBy: string; offeredTo: string }[]) {
        const outsider = log.cast.find((c) => c.name !== o.offeredBy && c.name !== o.offeredTo)!.name;
        steps.forEach((s, i) => {
          if (!(s.kind === 'turn' && (s.turn.phase === 'recruit_choose' || s.turn.phase === 'recruit_respond')) && !(s.kind === 'event' && s.event.type === 'recruit')) return;
          if (s.kind === 'turn' && s.turn.player === outsider) return; // their own turn is theirs
          const view = seatView(log, steps, i, outsider);
          expect(view.moment.title, `${outsider} at step ${i}`).not.toMatch(/recruit/i);
        });
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('holds for every seat, traitors and recruits included: no one else’s notes, no whisper they were not in', async () => {
    let recruits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const log = await playMock(seed);
      recruits += log.events.filter((e) => e.type === 'recruit' && e.accepted).length;
      const whispers = log.turns.filter((t) => t.phase === 'whispers' && typeof (t.action as { to?: unknown }).to === 'string' && ((t.action as { message?: string }).message ?? '').length > 8);
      for (const { seat, i, json } of views(log, () => true)) {
        for (const t of log.turns) {
          if (t.player !== seat && t.private_notes.trim() !== '') expect(json.includes(JSON.stringify(t.private_notes).slice(1, -1)), `${seed} ${seat} ${i} notes`).toBe(false);
        }
        for (const w of whispers) {
          const a = w.action as { to: string; message: string };
          if (w.player !== seat && a.to !== seat) expect(json.includes(JSON.stringify(a.message).slice(1, -1)), `${seed} ${seat} ${i} whisper`).toBe(false);
        }
      }
    }
    expect(recruits).toBeGreaterThan(0); // at least one recruited seat was among the seats checked
  });
});

describe('a seat’s own timeline', () => {
  it('has no run of empty steps and no step about a private recruitment, so its length tells nothing hidden', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const log = await playMock(seed);
      const steps = buildSteps(log);
      for (const c of log.cast) {
        const line = seatTimeline(log, steps, c.name);
        const moments = line.map((i) => seatView(log, steps, i, c.name).moment);
        for (let k = 1; k < moments.length; k++) {
          const empty = (m: (typeof moments)[number]): boolean => m.kind === 'none' && m.title !== 'Result';
          expect(empty(moments[k]!) && empty(moments[k - 1]!), `${seed} ${c.name}: two empty steps in a row at ${k}`).toBe(false);
        }
        expect(moments.some((m) => /closed doors|recruit/i.test(m.title) && m.kind === 'none')).toBe(false);
        expect(line.at(-1)).toBe(steps.length - 1); // it still ends on the result
      }
    }
  });

  it('gives a faithful one Night step per round however many traitors act or disagree', async () => {
    for (const traitors of [1, 2, 3]) {
      const log = await playMock(5, { traitors });
      const steps = buildSteps(log);
      const faithful = log.cast.find((c) => log.roles[c.name] === 'faithful')!.name;
      const line = seatTimeline(log, steps, faithful);
      const perRound = new Map<number, number>();
      for (const i of line) {
        const s = steps[i]!;
        if (s.section.title === 'Night') perRound.set(s.section.round, (perRound.get(s.section.round) ?? 0) + 1);
      }
      expect([...perRound.values()].every((n) => n === 1), `${traitors} traitors`).toBe(true);
      const fullNight = steps.filter((s) => s.section.title === 'Night').length;
      expect(fullNight).toBeGreaterThan(perRound.size); // the full timeline does show the extra night turns
    }
  });

  it('shows a recruited seat as a traitor, and its recruiter a fellow, as soon as the offer is accepted', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const log = await playMock(seed);
      const accepted = log.events.find((e) => e.type === 'recruit' && e.accepted) as { offeredBy: string; offeredTo: string } | undefined;
      if (!accepted) continue;
      const steps = buildSteps(log);
      const at = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'recruit');
      const target = seatView(log, steps, at, accepted.offeredTo).seats.find((s) => s.name === accepted.offeredTo)!;
      expect(target.role).toBe('traitor');
      const recruiter = seatView(log, steps, at, accepted.offeredBy).seats.find((s) => s.name === accepted.offeredTo)!;
      expect(recruiter.mark).toBe('fellow');
      return;
    }
    throw new Error('no game with an accepted recruitment in 40 seeds');
  });
});

describe('positionAtOrBefore', () => {
  it('stands on the last step at or before the one asked for, or the start', () => {
    const line = [0, 4, 9, 20];
    expect(positionAtOrBefore(line, 9)).toBe(2);
    expect(positionAtOrBefore(line, 12)).toBe(2);
    expect(positionAtOrBefore(line, 100)).toBe(3);
    expect(positionAtOrBefore(line, 0)).toBe(0);
    expect(positionAtOrBefore([5, 8], 2)).toBe(0);
    expect(positionAtOrBefore([], 3)).toBe(0);
  });
});
