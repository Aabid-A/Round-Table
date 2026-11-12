import type { GameEvent, GameLog } from '../../../src/engine/types.js';
import { renderEvent } from '../../../src/prompts/history.js';
import type { SceneMoment, SceneSeat, SceneView } from '../scene/view.js';
import type { Step } from '../replay/timeline.js';
import { knowledgeAt } from './knowledge.js';

const canSee = (e: GameEvent, seat: string): boolean => e.visibleTo === 'all' || e.visibleTo.includes(seat);

/** The highest turn id played up to and including the step at `index`, or -1. */
export function lastTurnAt(steps: Step[], index: number): number {
  let id = -1;
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i] as Step;
    if (s.kind === 'turn') id = s.turn.id;
  }
  return id;
}

function momentFor(step: Step, seat: string): SceneMoment {
  const none: SceneMoment = { title: step.section.title, round: step.kind === 'result' ? null : step.section.round, speaker: null, text: null, kind: 'none' };
  if (step.kind === 'turn') {
    const t = step.turn;
    // Round-table speech is said aloud to everyone. Every other turn is private to the one who took it.
    if (t.phase === 'round_table') return { ...none, speaker: t.player, text: t.speech, kind: 'speech' };
    // A whisper is shown to the two people in it, from their own side.
    const a = t.action as { to?: string | null; message?: string };
    if (t.phase === 'whispers' && typeof a.to === 'string' && typeof a.message === 'string' && (t.player === seat || a.to === seat)) {
      const whisper: GameEvent = { type: 'whisper', round: t.round, afterTurn: t.id, visibleTo: [t.player, a.to], from: t.player, to: a.to, message: a.message };
      return { ...none, text: renderEvent(whisper, seat), kind: 'event' };
    }
    if (t.player === seat && t.private_notes.trim() !== '') return { ...none, speaker: seat, text: t.private_notes, kind: 'thought' };
    return none;
  }
  if (step.kind === 'event' && canSee(step.event, seat)) return { ...none, text: renderEvent(step.event, seat), kind: 'event' };
  return none;
}

/**
 * What `seat` sees at the step at `index`: the facts their latest prompt gave them, the public events since (breakfast and
 * banishments, which everyone is told), and the current moment if the log says they could see it. Nothing else reaches the view.
 */
export function seatView(log: GameLog, steps: Step[], index: number, seat: string): SceneView {
  const k = knowledgeAt(log, seat, lastTurnAt(steps, index));
  const out = new Map((k?.out ?? []).map((o) => [o.name, o] as const));
  // Breakfast and banishments are shown to everyone; apply the ones played since this seat's last turn.
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i] as Step;
    if (s.kind !== 'event' || !canSee(s.event, seat)) continue;
    const e = s.event;
    if (e.type === 'breakfast' && e.victim !== null && e.role !== null) out.set(e.victim, { name: e.victim, how: 'murdered', role: e.role });
    if (e.type === 'banishment') out.set(e.player, { name: e.player, how: 'banished', role: e.role });
  }
  const seats: SceneSeat[] = log.cast.map((c) => {
    const gone = out.get(c.name);
    const mark = c.name === seat ? 'self' : k?.fellowTraitors.includes(c.name) ? 'fellow' : null;
    const role = gone ? gone.role : c.name === seat ? (k?.role ?? null) : mark === 'fellow' ? 'traitor' : null;
    const status = gone ? gone.how : 'alive';
    return { name: c.name, model: c.model, status, role, mark };
  });
  const step = steps[index] as Step;
  return { viewer: seat, seats, moment: momentFor(step, seat), night: step.section.title === 'Night' };
}
