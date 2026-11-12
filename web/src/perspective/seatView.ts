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

/** The title shown when the step is something this seat is not part of: an offer made in private says nothing, not even its name. */
const HIDDEN_TITLE = 'Behind closed doors';

/** Whispers are handed out once everyone has whispered: the turn after which no whispers turn of the round remains. */
function lastWhisperTurnOfRound(log: GameLog, turnId: number, round: number): boolean {
  const next = log.turns.find((t) => t.id > turnId);
  return !next || next.phase !== 'whispers' || next.round !== round;
}

function momentFor(step: Step, seat: string, log: GameLog): SceneMoment {
  const none: SceneMoment = { title: step.section.title, round: step.kind === 'result' ? null : step.section.round, speaker: null, text: null, kind: 'none' };
  if (step.kind === 'turn') {
    const t = step.turn;
    // Round-table speech is said aloud to everyone. Every other turn is private to the one who took it.
    if (t.phase === 'round_table') return { ...none, speaker: t.player, text: t.speech, kind: 'speech' };
    const lines: string[] = [];
    const a = t.action as { to?: string | null; message?: string };
    if (t.phase === 'whispers') {
      if (t.player === seat && typeof a.to === 'string' && typeof a.message === 'string') lines.push(renderEvent(whisperEvent(t.player, a.to, a.message, t.round, t.id), seat));
      // What was whispered to this seat reaches it when the whisper phase ends, not when the sender typed it.
      if (lastWhisperTurnOfRound(log, t.id, t.round)) {
        for (const w of log.turns) {
          const x = w.action as { to?: string | null; message?: string };
          if (w.phase === 'whispers' && w.round === t.round && w.player !== seat && x.to === seat && typeof x.message === 'string') lines.push(renderEvent(whisperEvent(w.player, seat, x.message, w.round, w.id), seat));
        }
      }
      if (lines.length > 0) return { ...none, text: lines.join(' '), kind: 'event' };
    }
    const isRecruit = t.phase === 'recruit_choose' || t.phase === 'recruit_respond';
    if (isRecruit && t.player !== seat) return { ...none, title: HIDDEN_TITLE };
    if (t.player === seat && t.private_notes.trim() !== '') return { ...none, speaker: seat, text: t.private_notes, kind: 'thought' };
    return none;
  }
  if (step.kind === 'event') {
    if (canSee(step.event, seat)) return { ...none, text: renderEvent(step.event, seat), kind: 'event' };
    if (step.event.type === 'recruit') return { ...none, title: HIDDEN_TITLE };
  }
  return none;
}

function whisperEvent(from: string, to: string, message: string, round: number, afterTurn: number): GameEvent {
  return { type: 'whisper', round, afterTurn, visibleTo: [from, to], from, to, message };
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
  return { viewer: seat, seats, moment: momentFor(step, seat, log), night: step.section.title === 'Night' };
}
