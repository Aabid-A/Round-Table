import type { GameLog } from '../../../src/engine/types.js';
import type { Role } from '../../../src/types.js';

/** What one player's prompt told them: the facts they are given at the start of a turn. */
export interface Knowledge {
  /** The seat this prompt was written for. */
  name: string;
  role: Role;
  fellowTraitors: string[];
  round: number;
  alive: string[];
  out: { name: string; how: 'murdered' | 'banished'; role: Role }[];
  /** The history lines, as that player was shown them. */
  history: string[];
}

const HISTORY_HEADER = '\n\nWhat you know so far:\n';

const list = (text: string): string[] => (text === '' ? [] : text.split(', '));

/**
 * Read a prompt written by src/prompts/phases.ts back into facts. Returns null for text that is not one of those prompts
 * (a hand-edited log), so a viewer shows nothing rather than a guess.
 */
export function parsePrompt(prompt: string): Knowledge | null {
  const cut = prompt.indexOf(HISTORY_HEADER);
  if (cut < 0) return null;
  const situation = prompt.slice(0, cut).split('\n');
  const afterHeader = prompt.slice(cut + HISTORY_HEADER.length);
  const end = afterHeader.indexOf('\n\n');
  const historyText = end < 0 ? afterHeader : afterHeader.slice(0, end);

  const who = /^You are (.+?)\. Your role: (traitor|faithful)\.$/.exec(situation[0] ?? '');
  if (!who) return null;
  const name = who[1] as string;
  const role = who[2] as Role;
  let fellowTraitors: string[] = [];
  let round = 0;
  let alive: string[] = [];
  const out: Knowledge['out'] = [];
  for (const line of situation.slice(1)) {
    let m: RegExpExecArray | null;
    if ((m = /^Your fellow traitors: (.*)\.$/.exec(line))) fellowTraitors = list(m[1] as string);
    else if ((m = /^Round (\d+)\. Players still in the game: (.*)\.$/.exec(line))) {
      round = Number(m[1]);
      alive = list(m[2] as string);
    } else if ((m = /^Out of the game: (.*)\.$/.exec(line))) {
      for (const part of (m[1] as string).split(/\), /)) {
        const e = /^(.+) \((murdered|banished), was a (traitor|faithful)\)?$/.exec(part);
        if (e) out.push({ name: e[1] as string, how: e[2] as 'murdered' | 'banished', role: e[3] as Role });
      }
    }
  }
  return {
    name,
    role,
    fellowTraitors,
    round,
    alive,
    out,
    history: historyText === 'Nothing has happened yet.' ? [] : historyText.split('\n'),
  };
}

/**
 * What `seat` knew once the turns up to and including `lastTurnId` had been played: what their latest prompt told them.
 * Null before their first turn, when nothing has been said to them yet.
 */
export function knowledgeAt(log: GameLog, seat: string, lastTurnId: number): Knowledge | null {
  let latest: string | null = null;
  for (const turn of log.turns) {
    if (turn.id > lastTurnId) break;
    if (turn.player === seat && turn.attempts[0]) latest = turn.attempts[0].prompt;
  }
  return latest === null ? null : parsePrompt(latest);
}
