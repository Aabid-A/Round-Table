/** What one line of a player's history says, read back from the text `renderEvent` wrote for that player. */
export type LiveEvent =
  | { kind: 'speech'; player: string; text: string; suspect: string; reason: string }
  | { kind: 'whisper_in'; from: string; text: string }
  | { kind: 'whisper_out'; to: string; text: string }
  | { kind: 'breakfast'; victim: string | null }
  | { kind: 'votes'; stage: 'vote' | 'revote'; votes: { voter: string; target: string }[] }
  | { kind: 'banished'; player: string }
  | { kind: 'round'; round: number }
  | { kind: 'other'; text: string };

const unquote = (s: string): string => (s === '(said nothing)' ? '' : s.replace(/^"|"$/g, ''));

/** One history line as an event. The lines are the player's own: their whispers read "You whispered to X". */
export function parseHistoryLine(line: string): LiveEvent {
  let m: RegExpExecArray | null;
  if ((m = /^-- Round (\d+) --$/.exec(line))) return { kind: 'round', round: Number(m[1]) };
  if ((m = /^(.+?) said (\(said nothing\)|".*") and suspects (.+?)(?: because: (.*))?\.$/.exec(line))) {
    return { kind: 'speech', player: m[1] as string, text: unquote(m[2] as string), suspect: m[3] as string, reason: m[4] ?? '' };
  }
  if ((m = /^(.+?) whispered to you: (\(said nothing\)|".*")$/.exec(line))) return { kind: 'whisper_in', from: m[1] as string, text: unquote(m[2] as string) };
  if ((m = /^You whispered to (.+?): (\(said nothing\)|".*")$/.exec(line))) return { kind: 'whisper_out', to: m[1] as string, text: unquote(m[2] as string) };
  if ((m = /^Breakfast: (.+?) was murdered in the night\./.exec(line))) return { kind: 'breakfast', victim: m[1] as string };
  if (line === 'Breakfast: nobody was murdered.') return { kind: 'breakfast', victim: null };
  if ((m = /^(Banishment vote|Revote): (.*)\.$/.exec(line))) {
    const votes = (m[2] as string).split(', ').flatMap((v) => {
      const p = /^(.+?) -> (.+)$/.exec(v);
      return p ? [{ voter: p[1] as string, target: p[2] as string }] : [];
    });
    return { kind: 'votes', stage: m[1] === 'Revote' ? 'revote' : 'vote', votes };
  }
  if ((m = /^(.+?) was banished\. They were a /.exec(line))) return { kind: 'banished', player: m[1] as string };
  return { kind: 'other', text: line };
}

/** The lines this prompt added to the history since the previous one: what the player has just learned. */
export function newHistoryLines(previous: string[] | null, current: string[]): string[] {
  if (previous === null) return current;
  const prefix = previous.every((line, i) => current[i] === line);
  return prefix ? current.slice(previous.length) : current;
}

/** The fellow traitor's proposals in a second-pass night prompt ("Their proposals: A -> B, C -> D"), if there are any. */
export function nightProposals(user: string): { by: string; target: string }[] {
  const m = /Their proposals: (.*?)\.\n/.exec(user);
  if (!m) return [];
  return (m[1] as string).split(', ').flatMap((p) => {
    const x = /^(.+?) -> (.+)$/.exec(p);
    return x ? [{ by: x[1] as string, target: x[2] as string }] : [];
  });
}

/** What a seat's room plays when a prompt arrives: the new news worth showing, minus your own words; after a reload (no earlier prompt) only the latest few. */
export function newsToPlay(previous: string[] | null, current: string[], me: string, reload: boolean): LiveEvent[] {
  const worth: LiveEvent['kind'][] = ['speech', 'whisper_in', 'breakfast', 'votes', 'banished'];
  const news = newHistoryLines(previous, current)
    .map(parseHistoryLine)
    .filter((e) => worth.includes(e.kind) && !(e.kind === 'speech' && e.player === me));
  return reload ? news.slice(-3) : news;
}
