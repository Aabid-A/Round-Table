import type { GameEvent, PlayerView } from '../engine/types.js';

const quote = (s: string): string => (s.trim() === '' ? '(said nothing)' : `"${s}"`);

/** Render one visible event as a line of text, from the viewer's point of view. */
export function renderEvent(event: GameEvent, me: string): string {
  switch (event.type) {
    case 'murder':
      return event.victim === null
        ? 'Your pack found no one to murder.'
        : `Your pack murdered ${event.victim}.`;
    case 'breakfast':
      return event.victim === null
        ? 'Breakfast: nobody was murdered.'
        : `Breakfast: ${event.victim} was murdered in the night. They were a ${event.role}.`;
    case 'whisper':
      return event.from === me
        ? `You whispered to ${event.to}: ${quote(event.message)}`
        : `${event.from} whispered to you: ${quote(event.message)}`;
    case 'speech':
      return `${event.player} said ${quote(event.speech)} and suspects ${event.suspect}${event.reason ? ` because: ${event.reason}` : ''}.`;
    case 'vote': {
      const label = event.stage === 'vote' ? 'Banishment vote' : 'Revote';
      const votes = event.votes.map((v) => `${v.voter} -> ${v.target}`).join(', ');
      return `${label}: ${votes}.`;
    }
    case 'banishment':
      return `${event.player} was banished. They were a ${event.role}.`;
    case 'recruit':
      return event.offeredBy === me
        ? `You offered ${event.offeredTo} a place among the traitors. They ${event.accepted ? 'accepted' : 'refused'}.`
        : `${event.offeredBy} offered you a place among the traitors. You ${event.accepted ? 'accepted' : 'refused'}.`;
    case 'endgame_vote': {
      const votes = event.votes.map((v) => `${v.voter}: ${v.choice}`).join(', ');
      return `End-or-banish vote: ${votes}. ${event.end ? 'The game ends.' : 'The game goes on.'}`;
    }
  }
}

/** The public and personal history one player may see, grouped by round. */
export function renderHistory(view: PlayerView): string {
  if (view.events.length === 0) return 'Nothing has happened yet.';
  const lines: string[] = [];
  let round = 0;
  for (const e of view.events) {
    if (e.round !== round) {
      round = e.round;
      lines.push(`-- Round ${round} --`);
    }
    lines.push(renderEvent(e, view.player));
  }
  return lines.join('\n');
}

/** Who is who, as far as this player is allowed to know. */
export function renderSituation(view: PlayerView): string {
  const lines = [`You are ${view.player}. Your role: ${view.role}.`];
  if (view.role === 'traitor') {
    lines.push(
      view.fellowTraitors.length > 0
        ? `Your fellow traitors: ${view.fellowTraitors.join(', ')}.`
        : 'You are the only traitor left.',
    );
  }
  lines.push(`Round ${view.round}. Players still in the game: ${view.alive.join(', ')}.`);
  if (view.eliminated.length > 0) {
    lines.push(
      `Out of the game: ${view.eliminated.map((e) => `${e.name} (${e.how}, was a ${e.role})`).join(', ')}.`,
    );
  }
  return lines.join('\n');
}
