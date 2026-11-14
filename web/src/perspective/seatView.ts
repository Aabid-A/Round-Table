import type { GameEvent, GameLog, Turn } from '../../../src/engine/types.js';
import { renderEvent } from '../../../src/prompts/history.js';
import type { SceneMoment, SceneSeat, SceneView } from '../scene/view.js';
import type { Step } from '../replay/timeline.js';
import { knowledgeAt } from './knowledge.js';
import { seatSight, stageAt } from './stage.js';

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
  const none: SceneMoment = { title: step.section.title, round: step.kind === 'result' ? null : step.section.round, speaker: null, text: null, thought: null, kind: 'none' };
  if (step.kind === 'turn') {
    const t = step.turn;
    // Round-table speech is said aloud to everyone. Every other turn is private to the one who took it.
    if (t.phase === 'round_table') return { ...none, speaker: t.player, text: t.speech, kind: 'speech', target: (t.action as { suspect?: string }).suspect ?? null };
    const lines: string[] = [];
    const a = t.action as { to?: string | null; message?: string };
    if (t.phase === 'whispers') {
      if (t.player === seat && typeof a.to === 'string' && typeof a.message === 'string') lines.push(renderEvent(whisperEvent(t.player, a.to, a.message, t.round, t.id), seat));
      // What was whispered to this seat reaches it when the whisper phase ends, not when the sender typed it.
      for (const w of whispersTo(log, t, seat)) lines.push(renderEvent(whisperEvent(w.player, seat, (w.action as { message: string }).message, w.round, w.id), seat));
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

/** The whispers that reach `seat` at turn `t`: all of the round's whispers to it, handed out once the whisper phase ends. */
function whispersTo(log: GameLog, t: Turn, seat: string): Turn[] {
  if (t.phase !== 'whispers' || !lastWhisperTurnOfRound(log, t.id, t.round)) return [];
  return log.turns.filter((w) => {
    const x = w.action as { to?: string | null; message?: string };
    return w.phase === 'whispers' && w.round === t.round && w.player !== seat && x.to === seat && typeof x.message === 'string';
  });
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
  // A recruitment this seat was told about changes who is a traitor now, before its next prompt says so.
  let selfRole = k?.role ?? null;
  const fellows = new Set(k?.fellowTraitors ?? []);
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i] as Step;
    if (s.kind !== 'event' || s.event.type !== 'recruit' || !s.event.accepted || !canSee(s.event, seat)) continue;
    if (s.event.offeredTo === seat) {
      selfRole = 'traitor';
      fellows.add(s.event.offeredBy);
    } else if (s.event.offeredBy === seat) fellows.add(s.event.offeredTo);
  }
  const seats: SceneSeat[] = log.cast.map((c) => {
    const gone = out.get(c.name);
    const mark = c.name === seat ? 'self' : fellows.has(c.name) && selfRole === 'traitor' ? 'fellow' : null;
    const role = gone ? gone.role : c.name === seat ? selfRole : mark === 'fellow' ? 'traitor' : null;
    const status = gone ? gone.how : 'alive';
    return { name: c.name, model: c.model, status, role, mark };
  });
  const step = steps[index] as Step;
  // A whisper reaching this seat is staged: the sender leans in. Otherwise whatever this seat saw happen (see stageAt).
  const whisper = step.kind === 'turn' ? whispersTo(log, step.turn, seat)[0] : undefined;
  return {
    viewer: seat,
    stage: whisper ? { kind: 'whisper', from: whisper.player, to: seat } : stageAt(log, steps, index, seatSight(seat)),
    seats,
    moment: momentFor(step, seat, log),
    night: step.section.title === 'Night',
    whispers: [],
    camera: { focus: seat, wide: false, cut: false },
  };
}

/**
 * The steps this seat's replay walks, as indexes into the full step list. A run of steps that show this seat nothing (the
 * other players' secret votes, the traitors' night) is one step, so the number of presses and the counter do not tell how
 * many traitors there are or whether they disagreed. A recruitment this seat is not part of is left out entirely.
 */
export function seatTimeline(log: GameLog, steps: Step[], seat: string): number[] {
  const timeline: number[] = [];
  let lastWasEmpty = false;
  steps.forEach((step, i) => {
    const m = momentFor(step, seat, log);
    if (m.title === HIDDEN_TITLE) return;
    const empty = m.kind === 'none' && step.kind !== 'result';
    if (!(empty && lastWasEmpty)) timeline.push(i);
    lastWasEmpty = empty;
  });
  return timeline;
}

/** How long a seated step stays up while playing: time to read what the seat is shown. */
export const seatStepMs = (view: SceneView): number => Math.min(9000, 1800 + (view.moment.text?.length ?? 0) * 40);

/** The position in `timeline` of the last step at or before `step` (0 when none is). Where a seat's replay stands for a moment. */
export function positionAtOrBefore(timeline: number[], step: number): number {
  let pos = 0;
  timeline.forEach((s, k) => {
    if (s <= step) pos = k;
  });
  return pos;
}
