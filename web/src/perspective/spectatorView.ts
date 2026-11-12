import type { GameLog } from '../../../src/engine/types.js';
import type { Context } from '../../../src/log/highlights/context.js';
import type { Role } from '../../../src/types.js';
import { describeStep } from '../replay/describe.js';
import { seatsAt, type Step } from '../replay/timeline.js';
import type { SceneMoment, SceneSeat, SceneView, SceneWhisper } from '../scene/view.js';
import { directorShot } from './director.js';

/** Everyone's role at the step: the starting roles, with each recruitment that has been accepted by then applied. */
function rolesAt(log: GameLog, steps: Step[], index: number): Record<string, Role> {
  const roles = { ...log.roles };
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i] as Step;
    if (s.kind === 'event' && s.event.type === 'recruit' && s.event.accepted) roles[s.event.offeredTo] = 'traitor';
  }
  return roles;
}

/**
 * The all-seeing view at the step at `index`: every seat's role with traitors marked, what is said with the speaker's private
 * notes beside it, whispers between seats drawn with their text, and the director's camera. For replays and published episodes
 * only: it shows everything, so it is never built for a game that is still being played.
 */
export function spectatorView(log: GameLog, steps: Step[], index: number, ctx: Context): SceneView {
  const step = steps[index] as Step;
  const described = describeStep(step, log);
  const roles = rolesAt(log, steps, index);
  const seats: SceneSeat[] = seatsAt(log, steps, index).map((s) => ({
    name: s.name,
    model: s.model,
    status: s.status,
    role: roles[s.name] ?? null,
    mark: roles[s.name] === 'traitor' ? 'traitor' : null,
  }));
  // A card says what happened in its title and body: "Hugo is banished. They were a faithful."
  const text = described.bubble?.text ?? (described.card ? `${described.card.title}. ${described.card.body}` : null);
  const moment: SceneMoment = {
    title: step.section.title,
    round: step.kind === 'result' ? null : step.section.round,
    speaker: described.bubble ? described.speaker : null,
    text,
    thought: described.notes,
    kind: described.bubble?.kind === 'speech' ? 'speech' : text ? 'event' : 'none',
  };
  const whispers: SceneWhisper[] = [];
  if (step.kind === 'turn' && step.turn.phase === 'whispers') {
    const a = step.turn.action as { to?: string | null; message?: string };
    if (typeof a.to === 'string' && typeof a.message === 'string' && a.message !== '') whispers.push({ from: step.turn.player, to: a.to, text: a.message });
  }
  const shot = directorShot(ctx, step);
  return { viewer: null, seats, moment, night: step.section.title === 'Night', whispers, camera: { focus: shot.focus, wide: shot.wide, cut: true } };
}
