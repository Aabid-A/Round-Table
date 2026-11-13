import { CANDLES, type SliceFigure, type SliceView } from '../scene/sliceView.js';
import { banished, dawnVictim, type SliceScript } from './script.js';

/** Where the slice is. Some stages wait for the player; the rest end by themselves after a time (or when skipped). */
export type Stage =
  | { kind: 'intro' }
  | { kind: 'speak'; i: number }
  | { kind: 'accuse' }
  | { kind: 'pointed' }
  | { kind: 'vote' }
  | { kind: 'tally' }
  | { kind: 'banish'; step: 'pushback' | 'leave' | 'mask' }
  | { kind: 'night' }
  | { kind: 'dawn' }
  | { kind: 'end' };

export interface SliceState {
  stage: Stage;
  accused: number | null;
  vote: number | null;
  hovered: number | null;
  selected: number | null;
  /** Filled in once the votes are in. */
  banished: number | null;
  victim: number | null;
}

export type Action = { t: 'advance' } | { t: 'hover'; seat: number | null } | { t: 'select'; seat: number } | { t: 'confirm' } | { t: 'restart' };

export const initial = (): SliceState => ({ stage: { kind: 'intro' }, accused: null, vote: null, hovered: null, selected: null, banished: null, victim: null });

/** How long a stage stays up on its own, in milliseconds, or null when it waits for the player. */
export function stageMs(stage: Stage): number | null {
  switch (stage.kind) {
    case 'intro': return 3000;
    case 'speak': return 4600;
    case 'accuse': return null;
    case 'pointed': return 2200;
    case 'vote': return null;
    case 'tally': return 3600;
    case 'banish': return stage.step === 'pushback' ? 1500 : stage.step === 'leave' ? 2400 : 3200;
    case 'night': return 4200;
    case 'dawn': return 5200;
    case 'end': return null;
  }
}

/** Seats the player may choose: any AI still at the table. */
export function choosable(state: SliceState, script: SliceScript): number[] {
  if (state.stage.kind !== 'accuse' && state.stage.kind !== 'vote') return [];
  return script.players.map((p) => p.index).filter((i) => i !== script.you && i !== state.banished);
}

function next(state: SliceState, script: SliceScript): SliceState {
  const s = state.stage;
  switch (s.kind) {
    case 'intro': return { ...state, stage: { kind: 'speak', i: 0 } };
    case 'speak': {
      const done = s.i + 1;
      if (done === script.yourTurnAfter) return { ...state, stage: { kind: 'accuse' }, selected: null };
      return done >= script.speeches.length ? { ...state, stage: { kind: 'vote' }, selected: null } : { ...state, stage: { kind: 'speak', i: done } };
    }
    case 'accuse': return state; // waits for the player
    case 'pointed': return { ...state, stage: { kind: 'speak', i: script.yourTurnAfter }, selected: null };
    case 'vote': return state;
    case 'tally': {
      const result = banished(script, state.vote ?? script.logBanished);
      return { ...state, banished: result.seat, stage: { kind: 'banish', step: 'pushback' } };
    }
    case 'banish':
      return s.step === 'pushback' ? { ...state, stage: { kind: 'banish', step: 'leave' } } : s.step === 'leave' ? { ...state, stage: { kind: 'banish', step: 'mask' } } : { ...state, stage: { kind: 'night' }, victim: dawnVictim(script, state.banished ?? 1) };
    case 'night': return { ...state, stage: { kind: 'dawn' } };
    case 'dawn': return { ...state, stage: { kind: 'end' } };
    case 'end': return state;
  }
}

export function reduce(state: SliceState, action: Action, script: SliceScript): SliceState {
  switch (action.t) {
    case 'restart':
      return initial();
    case 'advance':
      return next(state, script);
    case 'hover':
      return choosable(state, script).includes(action.seat ?? -1) || action.seat === null ? { ...state, hovered: action.seat } : state;
    case 'select':
      return choosable(state, script).includes(action.seat) ? { ...state, selected: action.seat } : state;
    case 'confirm': {
      const { stage, selected } = state;
      if (selected === null) return state;
      if (stage.kind === 'accuse') return { ...state, stage: { kind: 'pointed' }, accused: selected, selected: null };
      if (stage.kind === 'vote') return { ...state, stage: { kind: 'tally' }, vote: selected, selected: null };
      return state;
    }
  }
}

/** The scene's input for this state. The role of a seat is in it only once the game has shown it. */
export function viewOf(state: SliceState, script: SliceScript): SliceView {
  const { stage } = state;
  const shown = state.banished !== null && (stage.kind === 'night' || stage.kind === 'dawn' || stage.kind === 'end' || (stage.kind === 'banish' && stage.step === 'mask'));
  const gone = state.banished !== null && (stage.kind === 'night' || stage.kind === 'dawn' || stage.kind === 'end' || (stage.kind === 'banish' && stage.step !== 'pushback'));
  const dawn = state.victim !== null && (stage.kind === 'dawn' || stage.kind === 'end');
  const figures: SliceFigure[] = script.players.map((p) => ({
    index: p.index,
    name: p.name,
    mask: p.index,
    present: !(gone && p.index === state.banished) && !(dawn && p.index === state.victim),
    revealed: (shown && p.index === state.banished) || (dawn && p.index === state.victim) ? p.role : null,
  }));
  const speech = stage.kind === 'speak' ? script.speeches[stage.i] : undefined;
  const speaker = speech?.speaker ?? null;
  let pointing: SliceView['pointing'] = null;
  if (speech) pointing = { from: speech.speaker, at: speech.suspect };
  if (stage.kind === 'pointed' && state.accused !== null) pointing = { from: script.you, at: state.accused };
  const looks: (number | null)[] = script.players.map((p) => {
    if (speech) return p.index === speech.speaker ? speech.suspect : speech.speaker;
    if (stage.kind === 'pointed' && state.accused !== null) return state.accused;
    if (stage.kind === 'banish' && state.banished !== null) return state.banished;
    return null;
  });
  const tokens: SliceView['tokens'] = [];
  if (stage.kind === 'tally' || stage.kind === 'banish' || stage.kind === 'night') {
    for (const [owner, target] of Object.entries(script.aiVotes)) tokens.push({ owner: Number(owner), target });
    if (state.vote !== null) tokens.push({ owner: script.you, target: state.vote });
  }
  const names = script.players.map((p) => p.name);
  const announce = (() => {
    switch (stage.kind) {
      case 'intro': return 'You sit at the round table. Seven masked figures sit with you. The candles are lit.';
      case 'speak': return `${names[speech!.speaker]} says: ${speech!.text} They point at ${names[speech!.suspect]}.`;
      case 'accuse': return 'Your turn. Look at a figure and choose who you suspect, then confirm.';
      case 'pointed': return `You point at ${names[state.accused ?? 0]}. The table turns to look.`;
      case 'vote': return 'Time to vote. Choose the name your token slides toward, then confirm.';
      case 'tally': return 'The tokens slide across the table.';
      case 'banish': return state.banished === null ? '' : stage.step === 'pushback' ? `${names[state.banished]}'s chair is pushed back.` : stage.step === 'leave' ? `${names[state.banished]} stands and leaves the table.` : `Their mask is turned over: a ${script.players[state.banished]!.role}.`;
      case 'night': return 'Night. The candles go out, one by one. Only the fire is left.';
      case 'dawn': return state.victim === null ? '' : `Dawn. ${names[state.victim]}'s chair is empty. Their mask lies on the table: a ${script.players[state.victim]!.role}.`;
      case 'end': return 'The slice is over. You can sit through it again.';
    }
  })();
  return {
    figures,
    you: script.you,
    mood: stage.kind === 'night' ? 'night' : stage.kind === 'dawn' || stage.kind === 'end' ? 'dawn' : 'day',
    candlesLit: stage.kind === 'night' ? 0 : stage.kind === 'dawn' || stage.kind === 'end' ? 0 : CANDLES,
    speaker,
    speech: speech ? { text: speech.text, speaker: speech.speaker } : null,
    pointing,
    looks,
    tokens,
    banish: state.banished !== null && stage.kind === 'banish' ? { seat: state.banished, stage: stage.step, role: stage.step === 'mask' ? script.players[state.banished]!.role : null } : state.banished !== null && (stage.kind === 'night' || stage.kind === 'dawn' || stage.kind === 'end') ? { seat: state.banished, stage: 'done', role: script.players[state.banished]!.role } : null,
    dawn: dawn && state.victim !== null ? { victim: state.victim, role: script.players[state.victim]!.role } : null,
    choosable: choosable(state, script),
    hovered: state.hovered,
    selected: state.selected,
    announce,
  };
}
