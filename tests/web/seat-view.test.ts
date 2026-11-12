import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { seatView } from '../../web/src/perspective/seatView.js';
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
