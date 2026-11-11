import type { GameEvent, GameLog, Turn } from '../engine/types.js';

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

function turnLines(t: Turn): string[] {
  const a = t.action as unknown as Record<string, unknown>;
  const flag = t.fallback ? ' [FALLBACK: no valid reply]' : '';
  const say = t.speech.trim() === '' ? '' : `: "${oneLine(t.speech)}"`;
  let head: string;
  switch (t.phase) {
    case 'night':
      head = `${t.player} proposes murdering ${a.target}`;
      break;
    case 'whispers':
      head = a.to === null ? `${t.player} sends no whisper` : `${t.player} whispers to ${a.to}: "${oneLine(String(a.message))}"`;
      break;
    case 'round_table':
      head = `${t.player}${say || ': (no statement)'}\n    suspects ${a.suspect}${a.reason ? `: ${oneLine(String(a.reason))}` : ''}`;
      break;
    case 'vote':
      head = `${t.player} votes for ${a.target}${say}`;
      break;
    case 'revote':
      head = `${t.player} revotes for ${a.target}${say}`;
      break;
    case 'recruit_choose':
      head = a.target === null ? `${t.player} makes no recruitment offer` : `${t.player} offers ${a.target} a place among the traitors`;
      break;
    case 'recruit_respond':
      head = `${t.player} ${a.accept ? 'accepts' : 'refuses'} the offer`;
      break;
    case 'endgame_vote':
      head = `${t.player} votes to ${a.choice === 'end' ? 'END the game' : 'banish again'}${say}`;
      break;
  }
  const lines = [`  ${head}${flag}`];
  if (t.private_notes.trim() !== '') lines.push(`    [HIDDEN FROM PLAYERS] ${oneLine(t.private_notes)}`);
  return lines;
}

/** Events not already shown by a turn line (speech and whisper turns cover themselves). */
function eventLine(e: GameEvent): string | null {
  switch (e.type) {
    case 'murder':
      return e.victim === null ? '  >> The traitors found no victim.' : `  >> The traitors murder ${e.victim}${e.method === 'random' ? ' (they disagreed; picked at random)' : ''}.`;
    case 'breakfast':
      return e.victim === null ? '  >> Breakfast: nobody was murdered.' : `  >> Breakfast: ${e.victim} is gone. They were a ${e.role}.`;
    case 'vote': {
      const tally = Object.entries(e.tally).map(([n, c]) => `${n} ${c}`).join(', ');
      const tie = e.leaders.length > 1 ? ` Tie: ${e.leaders.join(', ')}.` : '';
      return `  >> ${e.stage === 'vote' ? 'Vote' : 'Revote'} result: ${tally}.${tie}`;
    }
    case 'banishment':
      return `  >> ${e.player} is banished (${e.method}). They were a ${e.role}.`;
    case 'recruit':
      return `  >> Recruitment: ${e.offeredBy} offered ${e.offeredTo}, who ${e.accepted ? 'ACCEPTED and is now a traitor' : 'refused'}.`;
    case 'endgame_vote':
      return `  >> End-or-banish vote: ${e.end ? 'the game ends' : 'the game goes on'}.`;
    case 'whisper':
    case 'speech':
      return null;
  }
}

const PHASE_TITLES: Record<string, string> = {
  night: 'Night',
  whispers: 'Whispers',
  round_table: 'Round table',
  vote: 'Banishment vote',
  revote: 'Revote',
  recruit_choose: 'Recruitment',
  recruit_respond: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

/** Plain-text transcript: public speech with each player's hidden private notes underneath. */
export function renderTranscript(log: GameLog): string {
  const out: string[] = [];
  out.push('THE ROUND TABLE');
  out.push(`seed ${log.seed}, max rounds ${log.settings.maxRounds}`);
  out.push('Cast (roles are hidden from the players):');
  for (const c of log.cast) out.push(`  ${c.name} (${c.model}): ${log.roles[c.name]}`);
  out.push('Lines marked [HIDDEN FROM PLAYERS] are private notes only viewers can see.');
  out.push('');

  const emit = (afterTurn: number): void => {
    for (const e of log.events) {
      if (e.afterTurn !== afterTurn) continue;
      const line = eventLine(e);
      if (line) out.push(line);
    }
  };

  emit(-1);
  let round = 0;
  let section = '';
  for (const t of log.turns) {
    if (t.round !== round) {
      round = t.round;
      section = '';
      out.push('', `=== Round ${round} ===`);
    }
    const title = PHASE_TITLES[t.phase] ?? t.phase;
    if (title !== section) {
      section = title;
      out.push('', `-- ${title} --`);
    }
    out.push(...turnLines(t));
    emit(t.id);
  }

  const r = log.result;
  out.push('', `=== Result: the ${r.winner}s win (${r.reason.replace(/_/g, ' ')}, round ${r.rounds}) ===`);
  out.push(`Survivors: ${r.survivors.map((s) => `${s.name} (${s.role})`).join(', ')}`);
  return `${out.join('\n')}\n`;
}
