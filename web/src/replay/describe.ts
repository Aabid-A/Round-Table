import type { GameEvent, GameLog, Turn } from '../../../src/engine/types.js';
import type { Step } from './timeline.js';

export type Tone = 'neutral' | 'danger' | 'reveal';

/** What the screen shows for one step. The components only draw this. */
export interface StepView {
  /** The seat that is speaking or acting. */
  speaker: string | null;
  /** The seat the step is about (a suspect, a victim, a vote target). */
  target: string | null;
  /** Text in the speech bubble on the speaker. */
  bubble: { text: string; kind: 'speech' | 'whisper' | 'action' } | null;
  /** A card in the middle of the table for events and the result. */
  card: { title: string; body: string; tone: Tone } | null;
  /** Rows under the table. */
  rows: { label: string; value: string }[];
  /** Vote counts, highest first. */
  tally: { name: string; count: number }[];
  /** The speaker's private notes. Only turns have them. */
  notes: string | null;
  /** True when no valid reply was given and a fallback action was used. */
  fallback: boolean;
}

const empty = (): StepView => ({
  speaker: null,
  target: null,
  bubble: null,
  card: null,
  rows: [],
  tally: [],
  notes: null,
  fallback: false,
});

function describeTurn(t: Turn): StepView {
  const v = empty();
  v.speaker = t.player;
  v.fallback = t.fallback;
  v.notes = t.private_notes.trim() === '' ? null : t.private_notes;
  const a = t.action as unknown as Record<string, unknown>;
  const said = t.speech.trim();
  const action = (text: string): void => {
    v.bubble = { text: said === '' ? text : said, kind: said === '' ? 'action' : 'speech' };
  };
  switch (t.phase) {
    case 'night':
      v.target = a.target as string;
      v.bubble = { text: `Proposes murdering ${a.target}`, kind: 'action' };
      break;
    case 'whispers':
      if (a.to === null) v.bubble = { text: 'Sends no whisper', kind: 'action' };
      else {
        v.target = a.to as string;
        v.bubble = { text: String(a.message), kind: 'whisper' };
        v.rows.push({ label: 'Whispers to', value: a.to as string });
      }
      break;
    case 'round_table':
      v.target = a.suspect as string;
      v.bubble = { text: said === '' ? '(no statement)' : said, kind: 'speech' };
      if (said !== '') v.rows.push({ label: 'Said', value: said }); // the bubble clips long speech; this is the full text
      v.rows.push({ label: 'Suspects', value: a.suspect as string });
      if (String(a.reason) !== '') v.rows.push({ label: 'Because', value: String(a.reason) });
      break;
    case 'vote':
    case 'revote':
      v.target = a.target as string;
      action(`Votes for ${a.target}`);
      v.rows.push({ label: t.phase === 'vote' ? 'Votes for' : 'Revotes for', value: a.target as string });
      break;
    case 'recruit_choose':
      if (a.target === null) action('Makes no offer');
      else {
        v.target = a.target as string;
        action(`Offers ${a.target} a place among the traitors`);
      }
      break;
    case 'recruit_respond':
      action(a.accept ? 'Accepts the offer' : 'Refuses the offer');
      break;
    case 'endgame_vote':
      action(a.choice === 'end' ? 'Votes to end the game' : 'Votes to banish again');
      break;
  }
  return v;
}

function describeEvent(e: GameEvent): StepView {
  const v = empty();
  switch (e.type) {
    case 'murder':
      v.target = e.victim;
      v.card = {
        title: 'The traitors choose',
        body: e.victim === null ? 'Nobody to murder.' : e.victim,
        tone: 'danger',
      };
      v.rows = e.proposals.map((p) => ({ label: `${p.player} proposed`, value: p.target }));
      if (e.method === 'random') v.rows.push({ label: 'They disagreed', value: 'one proposal was picked at random' });
      break;
    case 'breakfast':
      v.target = e.victim;
      v.card = {
        title: 'Breakfast',
        body: e.victim === null ? 'Nobody was murdered.' : `${e.victim} was murdered in the night. They were a ${e.role}.`,
        tone: e.victim === null ? 'neutral' : 'reveal',
      };
      break;
    case 'vote': {
      const tally = Object.entries(e.tally)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      v.tally = tally;
      v.rows = e.votes.map((x) => ({ label: x.voter, value: x.target }));
      v.card = {
        title: e.stage === 'vote' ? 'Vote result' : 'Revote result',
        body:
          e.leaders.length === 0
            ? 'No votes were cast.'
            : e.leaders.length > 1
              ? `Tie between ${e.leaders.join(' and ')}.`
              : `${e.leaders[0]} has the most votes.`,
        tone: 'neutral',
      };
      break;
    }
    case 'banishment':
      v.target = e.player;
      v.card = {
        title: `${e.player} is banished`,
        body: `They were a ${e.role}.${e.method === 'revote' ? ' Decided by a revote.' : e.method === 'random' ? ' The tie was settled at random.' : ''}`,
        tone: 'reveal',
      };
      break;
    case 'recruit':
      v.speaker = e.offeredBy;
      v.target = e.offeredTo;
      v.card = {
        title: 'Recruitment',
        body: `${e.offeredBy} offered ${e.offeredTo} a place among the traitors. ${e.accepted ? 'They accepted.' : 'They refused.'}`,
        tone: e.accepted ? 'danger' : 'neutral',
      };
      break;
    case 'endgame_vote':
      v.rows = e.votes.map((x) => ({ label: x.voter, value: x.choice === 'end' ? 'end the game' : 'banish again' }));
      v.card = { title: 'End or banish', body: e.end ? 'The game ends.' : 'The game goes on.', tone: 'neutral' };
      break;
    case 'whisper':
    case 'speech':
      break;
  }
  return v;
}

const REASONS: Record<GameLog['result']['reason'], string> = {
  no_traitors: 'No traitors are left.',
  no_faithfuls: 'No faithfuls are left.',
  two_remaining: 'Two players remain.',
  endgame_vote: 'The survivors voted to end the game.',
  max_rounds: 'The last round was played.',
  cost_cap: 'The game was stopped early by a cost cap.',
  call_limit: 'The game was stopped early by its limit on calls to players.',
};

export function describeStep(step: Step, log: GameLog): StepView {
  if (step.kind === 'turn') return describeTurn(step.turn);
  if (step.kind === 'event') return describeEvent(step.event);
  const r = log.result;
  const v = empty();
  v.card = {
    title: r.winner === null ? 'No winner' : `The ${r.winner}s win`,
    body: `${REASONS[r.reason]} ${r.rounds} round${r.rounds === 1 ? '' : 's'} played.`,
    tone: 'reveal',
  };
  v.rows = r.survivors.map((s) => ({ label: s.name, value: `survived as a ${s.role}` }));
  return v;
}

/** How long a step stays on screen while playing: a base plus reading time for the text. */
export function stepDurationMs(view: StepView): number {
  const chars =
    (view.bubble?.text.length ?? 0) +
    (view.card?.body.length ?? 0) +
    view.rows.reduce((n, r) => n + (r.label.length + r.value.length) / 3, 0);
  return Math.min(9000, Math.max(1500, 1200 + chars * 40));
}
