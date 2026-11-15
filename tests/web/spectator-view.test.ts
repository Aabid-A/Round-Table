import { describe, expect, it } from 'vitest';
import { buildContext } from '../../src/log/highlights/context.js';
import { directorShot } from '../../web/src/perspective/director.js';
import { spectatorView } from '../../web/src/perspective/spectatorView.js';
import { buildSteps, finalRoles } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

describe('spectatorView', () => {
  it('shows every role with traitors marked, and every recruit as a traitor from the moment they accept', async () => {
    let sawRecruit = false;
    for (let seed = 1; seed <= 12; seed++) {
      const log = await playMock(seed);
      const ctx = buildContext(log);
      const steps = buildSteps(log);
      steps.forEach((_, i) => {
        const view = spectatorView(log, steps, i, ctx);
        for (const s of view.seats) {
          expect(s.role).not.toBeNull();
          expect(s.mark === 'traitor', `${seed} step ${i} ${s.name}`).toBe(s.role === 'traitor');
        }
      });
      const last = spectatorView(log, steps, steps.length - 1, ctx);
      for (const [name, role] of Object.entries(finalRoles(log))) expect(last.seats.find((s) => s.name === name)!.role).toBe(role);
      const recruit = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'recruit' && s.event.accepted);
      if (recruit >= 0) {
        sawRecruit = true;
        const e = (steps[recruit] as { event: { offeredTo: string } }).event;
        expect(spectatorView(log, steps, recruit - 1, ctx).seats.find((s) => s.name === e.offeredTo)!.role).toBe('faithful');
        expect(spectatorView(log, steps, recruit, ctx).seats.find((s) => s.name === e.offeredTo)!.role).toBe('traitor');
      }
    }
    expect(sawRecruit).toBe(true);
  });

  it('puts the speaker’s private notes beside what they said', async () => {
    const log = await playMock(2);
    const ctx = buildContext(log);
    const steps = buildSteps(log);
    let checked = 0;
    steps.forEach((s, i) => {
      if (s.kind !== 'turn' || s.turn.phase !== 'round_table') return;
      const m = spectatorView(log, steps, i, ctx).moment;
      expect(m.speaker).toBe(s.turn.player);
      expect(m.kind).toBe('speech');
      expect(m.text).toBe(s.turn.speech);
      expect(m.thought).toBe(s.turn.private_notes);
      checked++;
    });
    expect(checked).toBeGreaterThan(5);
  });

  it('draws a whisper as a line between the two seats with its text, and only during that whisper', async () => {
    const log = await playMock(2);
    const ctx = buildContext(log);
    const steps = buildSteps(log);
    let lines = 0;
    steps.forEach((s, i) => {
      const view = spectatorView(log, steps, i, ctx);
      const a = s.kind === 'turn' && s.turn.phase === 'whispers' ? (s.turn.action as { to?: string | null; message?: string }) : null;
      if (a && typeof a.to === 'string' && a.message) {
        expect(view.whispers).toEqual([{ from: (s as { turn: { player: string } }).turn.player, to: a.to, text: a.message }]);
        lines++;
      } else expect(view.whispers).toEqual([]);
    });
    expect(lines).toBeGreaterThan(3);
  });

  it('takes its camera from the director, as a cut', async () => {
    const log = await playMock(4);
    const ctx = buildContext(log);
    const steps = buildSteps(log);
    steps.forEach((s, i) => {
      const shot = directorShot(ctx, s);
      expect(spectatorView(log, steps, i, ctx).camera).toEqual({ focus: shot.focus, wide: shot.wide, cut: true });
    });
  });
});

describe('the all-seeing room in 3D', () => {
  it('shows every living role above its seat, the speaker’s notes beside them, and whispers as lines', async () => {
    const { readFileSync } = await import('node:fs');
    const { buildContext } = await import('../../src/log/highlights/context.js');
    const { buildSteps } = await import('../../web/src/replay/timeline.js');
    const { spectatorView } = await import('../../web/src/perspective/spectatorView.js');
    const { worldFromScene } = await import('../../web/src/scene/fromScene.js');
    const log = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8'));
    const steps = buildSteps(log);
    const ctx = buildContext(log);
    const first = worldFromScene(spectatorView(log, steps, 0, ctx), '');
    expect(first.figures.filter((f) => f.known).length).toBe(8);
    expect(first.figures.filter((f) => f.known === 'traitor').map((f) => f.name).sort()).toEqual(['Bram', 'Cleo']);
    const whisper = steps.findIndex((s) => s.kind === 'turn' && s.turn.phase === 'whispers' && (s.turn.action as { to?: string | null }).to);
    expect(worldFromScene(spectatorView(log, steps, whisper, ctx), '').whisperLines).toHaveLength(1);
    const noted = steps.findIndex((s) => s.kind === 'turn' && s.turn.phase === 'round_table' && s.turn.private_notes.trim() !== '');
    expect(worldFromScene(spectatorView(log, steps, noted, ctx), '').thought?.text).toBeTruthy();
  });
});
