import type { GameLog } from '../../../src/engine/types.js';
import { SEES_ALL, stageAt } from '../perspective/stage.js';
import type { SceneView } from '../scene/view.js';
import type { StepView } from './describe.js';
import { seatsAt, type Step } from './timeline.js';

/**
 * The public replay table as a scene view, so the 3D room can show it: exactly what the flat table shows for the step and no more.
 * Roles are those the game has made public; there are no private notes. The camera sits in no chair and follows whoever acts.
 */
export function tableSceneView(log: GameLog, steps: Step[], index: number, view: StepView): SceneView {
  const step = steps[index]!;
  const seats = seatsAt(log, steps, index).map((s) => ({ name: s.name, model: s.model, status: s.status, role: s.revealedRole, mark: null }));
  const said = view.bubble ? view.bubble.text : view.card ? `${view.card.title}. ${view.card.body}` : null;
  const speech = view.bubble !== null && view.speaker !== null;
  const stage = stageAt(log, steps, index, SEES_ALL);
  return {
    viewer: null,
    seats,
    moment: {
      title: step.section.title,
      round: step.kind === 'result' ? null : step.section.round,
      speaker: speech ? view.speaker : null,
      text: said,
      thought: null,
      kind: speech ? 'speech' : said ? 'event' : 'none',
      target: step.kind === 'turn' && step.turn.phase === 'round_table' ? view.target : null,
    },
    night: step.section.title === 'Night',
    whispers: [],
    // Wide for the votes and the reveal at the end; on whoever acts otherwise, and on the one an event is about.
    camera: { focus: view.speaker ?? view.target, wide: stage?.kind === 'votes' || step.kind === 'result', cut: step.kind === 'event' },
    pov: 'third',
    stage,
  };
}
