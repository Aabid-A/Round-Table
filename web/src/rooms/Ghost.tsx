import { useState } from 'react';
import type { ServerMessage } from '../../../server/protocol.js';
import { liveView } from '../live/liveView.js';
import { parsePrompt } from '../perspective/knowledge.js';
import { Room } from '../scene/Room.js';

type GhostMessage = Extract<ServerMessage, { t: 'ghost' }>;

/**
 * A person who is out of the game, watching: pick any seat and see the room as that seat last saw it. This is hidden information,
 * which is why the host had to turn ghosts on and the lobby said so. It is only ever built from a ghost message, which the server
 * sends to people who are out.
 */
export function Ghost({ ghost }: { ghost: GhostMessage }) {
  const [picked, setPicked] = useState<string | null>(null);
  const seat = ghost.seats.find((s) => s.name === picked) ?? ghost.seats.find((s) => s.name !== ghost.you && s.prompt !== null) ?? ghost.seats[0];
  const knowledge = seat?.prompt ? parsePrompt(seat.prompt) : null;
  const view = knowledge
    ? liveView({ me: knowledge.name, order: ghost.seats.map((s) => s.name), knowledge, beat: null, turn: null, publicPhase: null, picked: null, timer: null })
    : null;

  return (
    <section className="ghost" data-testid="ghost" aria-label="Watching as a ghost">
      <p className="notice" role="status">
        You are out of the game, and watching as a ghost. You can see what every seat knows, hidden information included. The game goes on without
        you.
      </p>
      <div role="group" aria-label="Seats to watch" className="ghost-seats">
        {ghost.seats.map((s) => (
          <button
            key={s.name}
            type="button"
            className="btn"
            aria-pressed={s.name === seat?.name}
            data-testid="ghost-seat"
            data-name={s.name}
            onClick={() => setPicked(s.name)}
          >
            {s.name}
            {s.name === ghost.you ? ' (you)' : ''}
            {s.status !== 'alive' ? ` (${s.status})` : ''}
          </button>
        ))}
      </div>
      {view && seat ? (
        <div className="live-room">
          <Room view={view} label={`The room as ${seat.name} sees it`} />
        </div>
      ) : (
        <p className="notice" data-testid="ghost-empty">
          {seat ? `${seat.name} has not been told anything yet.` : 'There is nothing to watch yet.'}
        </p>
      )}
    </section>
  );
}
