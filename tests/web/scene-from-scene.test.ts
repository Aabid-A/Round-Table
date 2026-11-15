import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { seatView } from '../../web/src/perspective/seatView.js';
import { buildSteps, finalRoles } from '../../web/src/replay/timeline.js';
import { BANISH_BEATS, worldFromScene } from '../../web/src/scene/fromScene.js';
import { playMock } from '../helpers/game.js';

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(sample);

describe('the room for a scene view', () => {
  it('turns the viewer’s chair to the camera and keeps every player’s own mask', () => {
    const viewer = sample.cast[3]!.name;
    const w = worldFromScene(seatView(sample, steps, 5, viewer), '');
    expect(w.you).toBe(0);
    expect(w.figures.map((f) => f.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(w.figures.find((f) => f.index === 0)!.name).toBe(viewer);
    for (const f of w.figures) expect(f.mask).toBe(sample.cast.findIndex((c) => c.name === f.name));
  });

  it('stages a banishment beat by beat: the chair, the leaving, then the mask turned over', () => {
    const ban = steps.findIndex((s) => s.kind === 'event' && s.event.type === 'banishment');
    const viewer = sample.cast[0]!.name;
    const scene = seatView(sample, steps, ban, viewer);
    const beats = BANISH_BEATS.map((_, b) => worldFromScene(scene, '', b));
    const seat = beats[0]!.banish!.seat;
    expect(beats.map((w) => w.banish!.stage)).toEqual(BANISH_BEATS);
    expect(beats.map((w) => w.figures.find((f) => f.index === seat)!.present)).toEqual([true, false, false, false]);
    expect(beats.map((w) => w.banish!.role !== null)).toEqual([false, false, true, true]);
    expect(beats[0]!.tokens.length).toBeGreaterThan(0);
  });

  it('never gives the room a role, a fellow traitor or a whisper the scene view did not hold (7 games, every faithful seat)', async () => {
    let checked = 0;
    for (const log of [sample, ...(await Promise.all([1, 2, 3, 4, 5, 6].map((s) => playMock(s))))]) {
      const st = buildSteps(log);
      for (const c of log.cast) {
        if (finalRoles(log)[c.name] !== 'faithful') continue;
        for (let i = 0; i < st.length; i++) {
          const scene = seatView(log, st, i, c.name);
          for (const b of [0, 3]) {
            const w = worldFromScene(scene, '', b);
            for (const f of w.figures) {
              if (f.revealed !== null) expect(f.revealed).toBe(scene.seats.find((s) => s.name === f.name)!.role);
              if (f.present && f.index !== 0) expect(f.revealed).toBeNull();
              expect(f.fellow).toBeUndefined();
            }
            if (w.whisper) expect(w.whisper.to).toBe(0);
            if (w.recruit) expect([w.recruit.from, w.recruit.to]).toContain(0);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('the words of a banishment', () => {
  it('say what is seen, beat by beat, and the role only once the mask is turned over', async () => {
    const { banishWords } = await import('../../web/src/scene/fromScene.js');
    const full = 'Aria is banished. They were a faithful.';
    expect(banishWords('Aria', 0, full)).toBe("Aria's chair is pushed back.");
    expect(banishWords('Aria', 1, full)).not.toMatch(/faithful|traitor/);
    expect(banishWords('Aria', 2, full)).toBe(full);
  });
});

describe('a traitor’s seat in the room', () => {
  it('marks fellow traitors only, and stages only recruitments it took part in (9 games, every traitor seat)', async () => {
    let fellows = 0;
    for (const log of [sample, ...(await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((s) => playMock(s))))]) {
      const st = buildSteps(log);
      const roles = finalRoles(log);
      for (const c of log.cast) {
        if (roles[c.name] !== 'traitor') continue;
        for (let i = 0; i < st.length; i++) {
          const scene = seatView(log, st, i, c.name);
          const w = worldFromScene(scene, '');
          for (const f of w.figures) {
            if (f.fellow) {
              fellows++;
              expect(roles[f.name], `${c.name} step ${i}: ${f.name}`).toBe('traitor');
              expect(scene.seats.find((s) => s.name === f.name)!.mark).toBe('fellow');
            }
          }
          if (w.recruit) expect([w.recruit.from, w.recruit.to]).toContain(0);
        }
      }
    }
    expect(fellows).toBeGreaterThan(0);
  });
});
