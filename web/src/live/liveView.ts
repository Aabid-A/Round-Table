import type { Phase, Role } from '../../../src/types.js';
import type { PublicPhase } from '../../../src/publicPhase.js';
import type { Knowledge } from '../perspective/knowledge.js';
import type { SceneMoment, SceneSeat, SceneTimer, SceneView, SceneWhisper } from '../scene/view.js';
import { nightProposals, type LiveEvent } from './events.js';

const PHASE_TITLE: Record<Phase, string> = {
  night: 'Night',
  whispers: 'Whispers',
  round_table: 'Round table',
  vote: 'Banishment vote',
  revote: 'Revote',
  recruit_choose: 'Recruitment',
  recruit_respond: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

const PUBLIC_TITLE: Record<PublicPhase, string> = {
  night: 'Night',
  whispers: 'Whispers',
  round_table: 'Round table',
  vote: 'Banishment vote',
  revote: 'Revote',
  recruit: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

/** The ring order of the seats: the first prompt's order, with any seat first heard of later added at the end, so no chair ever moves. */
export function ringOrder(previous: string[], k: Knowledge): string[] {
  const known = new Set(previous);
  return [...previous, ...[...k.alive, ...k.out.map((o) => o.name)].filter((n) => !known.has(n))];
}

export interface LiveSnapshot {
  me: string;
  order: string[];
  /** What the latest prompt told this player. Null until their first turn. */
  knowledge: Knowledge | null;
  /** The line of news being played now, if one is. */
  beat: LiveEvent | null;
  /** This player's open turn, if there is one. */
  turn: { phase: Phase; options: string[]; user: string } | null;
  /** The phase everyone at the table is told of. */
  publicPhase: PublicPhase | null;
  picked: string | null;
  timer: SceneTimer | null;
}

function momentFor(s: LiveSnapshot): { moment: SceneMoment; whispers: SceneWhisper[]; leanTo: string | null } {
  const title = s.turn ? PHASE_TITLE[s.turn.phase] : s.publicPhase ? PUBLIC_TITLE[s.publicPhase] : 'The game is starting';
  const base: SceneMoment = { title, round: s.knowledge?.round ?? null, speaker: null, text: null, thought: null, kind: 'none' };
  const b = s.beat;
  if (!b) return { moment: base, whispers: [], leanTo: null };
  switch (b.kind) {
    case 'speech':
      return {
        moment: { ...base, title: 'Round table', speaker: b.player, text: `${b.text === '' ? '(said nothing)' : b.text} Suspects ${b.suspect}${b.reason ? ` because ${b.reason}` : ''}.`, kind: 'speech' },
        whispers: [],
        leanTo: b.player,
      };
    case 'whisper_in':
      return { moment: { ...base, title: 'Whispers', speaker: b.from, text: `Whispers to you: ${b.text}`, kind: 'event' }, whispers: [{ from: b.from, to: s.me, text: b.text }], leanTo: b.from };
    case 'whisper_out':
      return { moment: { ...base, title: 'Whispers', text: `You whispered to ${b.to}: ${b.text}`, kind: 'event' }, whispers: [], leanTo: null };
    case 'breakfast':
      return { moment: { ...base, title: 'Breakfast', text: b.victim === null ? 'Nobody was murdered.' : `${b.victim} was murdered in the night.`, kind: 'event' }, whispers: [], leanTo: null };
    case 'votes':
      return { moment: { ...base, title: b.stage === 'vote' ? 'Banishment vote' : 'Revote', text: b.votes.map((v) => `${v.voter} voted for ${v.target}`).join('. ') + '.', kind: 'event' }, whispers: [], leanTo: null };
    case 'banished':
      return { moment: { ...base, title: 'Banishment', text: `${b.player} was banished.`, kind: 'event' }, whispers: [], leanTo: null };
    case 'round':
    case 'other':
      return { moment: base, whispers: [], leanTo: null };
  }
}

/**
 * The room as the player in seat `me` sees it, from their own chair. Everything here comes from what this player was already
 * sent: their latest prompt (role, fellow traitors, who is out and what they were), the public phase, and their own open turn.
 * Nothing about another player's role, notes or whispers can be in it.
 */
export function liveView(s: LiveSnapshot): SceneView {
  const k = s.knowledge;
  const out = new Map((k?.out ?? []).map((o) => [o.name, o] as const));
  const fellows = new Set(k?.fellowTraitors ?? []);
  const seats: SceneSeat[] = s.order.map((name) => {
    const gone = out.get(name);
    const mark = name === s.me ? 'self' : k?.role === 'traitor' && fellows.has(name) ? 'fellow' : null;
    const role: Role | null = gone ? gone.role : name === s.me ? (k?.role ?? null) : mark === 'fellow' ? 'traitor' : null;
    return { name, model: '', status: gone ? gone.how : 'alive', role, mark };
  });
  const night = s.turn?.phase === 'night' || (s.turn === null && s.publicPhase === 'night');
  const { moment, whispers, leanTo } = momentFor(s);
  const nameOptions = s.turn ? s.turn.options.filter((o) => s.order.includes(o)) : [];
  return {
    viewer: s.me,
    seats,
    moment,
    night,
    whispers,
    camera: { focus: s.me, wide: false, cut: false },
    pov: 'first',
    // A faithful sleeps through the night: the screen goes dark, and they wake to whatever the morning shows. Until the first
    // prompt there is no way to know the role, so that night is only dim.
    sleep: night && s.turn === null && k?.role === 'faithful',
    leanTo,
    proposals: s.turn?.phase === 'night' && k?.role === 'traitor' ? nightProposals(s.turn.user) : [],
    timer: s.timer,
    picking: s.turn && nameOptions.length > 0 ? { options: nameOptions, picked: s.picked } : null,
  };
}
