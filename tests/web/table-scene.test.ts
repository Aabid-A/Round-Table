import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { describeStep } from '../../web/src/replay/describe.js';
import { tableSceneView } from '../../web/src/replay/tableScene.js';
import { buildSteps, seatsAt } from '../../web/src/replay/timeline.js';
import { worldFromScene } from '../../web/src/scene/fromScene.js';

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(sample);

describe('the public replay table in the room', () => {
  it('shows only the roles the game made public, no private notes, and the words the flat table shows', () => {
    steps.forEach((step, i) => {
      const view = describeStep(step, sample);
      const scene = tableSceneView(sample, steps, i, view);
      const seats = seatsAt(sample, steps, i);
      for (const s of scene.seats) expect(s.role).toBe(seats.find((x) => x.name === s.name)!.revealedRole);
      expect(scene.moment.thought).toBeNull();
      expect(scene.whispers).toEqual([]);
      if (view.bubble) expect(scene.moment.text).toBe(view.bubble.text);
      if (view.notes) expect(JSON.stringify(scene)).not.toContain(view.notes);
    });
  });
  it('seats no one in a chair: the room is filmed by the director', () => {
    const w = worldFromScene(tableSceneView(sample, steps, 3, describeStep(steps[3]!, sample)), '');
    expect(w.you).toBeNull();
    expect(w.shot).toBeDefined();
    expect(w.figures.map((f) => f.mask)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('points the speaker at the one accused at the round table', () => {
    const i = steps.findIndex((s) => s.kind === 'turn' && s.turn.phase === 'round_table');
    const w = worldFromScene(tableSceneView(sample, steps, i, describeStep(steps[i]!, sample)), '');
    expect(w.pointing).not.toBeNull();
    expect(w.speech?.speaker).toBe(w.pointing!.from);
  });
});
