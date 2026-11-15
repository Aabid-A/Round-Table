import { useState } from 'react';
import type { ServerMessage } from '../../../server/protocol.js';
import type { PublicPhase } from '../../../src/publicPhase.js';
import { liveView } from '../live/liveView.js';
import { parsePrompt } from '../perspective/knowledge.js';
import { FlatRoom } from '../scene/FlatRoom.js';
import { worldFromScene } from '../scene/fromScene.js';
import { useRoomChoice, useRoomSound } from '../scene/host.js';
import { Hud } from '../shell/Hud.js';
import { Shell } from '../shell/Shell.js';
import { momentWords } from '../replay/momentWords.js';
import { LiveRoom } from '../live/LiveRoom.js';

type GhostMessage = Extract<ServerMessage, { t: 'ghost' }>;

/**
 * A person who is out of the game, watching: pick any seat and see the room as that seat last saw it. This is hidden information,
 * which is why the host had to turn ghosts on and the lobby said so. It is only ever built from a ghost message, which the server
 * sends to people who are out.
 */
export function Ghost({ ghost, phase }: { ghost: GhostMessage; phase: PublicPhase | null }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choice = useRoomChoice(window.location.search);
  const sound = useRoomSound();
  const seat = ghost.seats.find((s) => s.name === picked) ?? ghost.seats.find((s) => s.name !== ghost.you && s.prompt !== null) ?? ghost.seats[0];
  const knowledge = seat?.prompt ? parsePrompt(seat.prompt) : null;
  // The phase everyone is told of names the moment. A ghost is watching, not sleeping: the night is dim but never a blackout.
  const view = knowledge
    ? { ...liveView({ me: knowledge.name, order: ghost.seats.map((s) => s.name), knowledge, beat: null, turn: null, publicPhase: phase, picked: null, timer: null }), sleep: false }
    : null;
  // In the 3D room the ghost sits in the watched seat's chair and sees only what that seat was told.
  const world = view && choice.room ? worldFromScene(view, momentWords(view)) : null;
  const label = seat ? `The room as ${seat.name} sees it` : '';

  const seatButtons = ghost.seats.map((s) => (
    <button key={s.name} type="button" className={world ? 'hud-btn' : 'btn'} aria-pressed={s.name === seat?.name} data-testid="ghost-seat" data-name={s.name} onClick={() => setPicked(s.name)}>
      {s.name}
      {s.name === ghost.you ? ' (you)' : ''}
      {s.status !== 'alive' ? ` (${s.status})` : ''}
    </button>
  ));

  if (world && view && seat) {
    // The game shell: the watched seat's room fills the window; the seats to watch from are one bar over it.
    return (
      <Shell label="Watching as a ghost">
        <section className="ghost ghost-shell" data-testid="ghost" aria-label="Watching as a ghost">
          <div className="live-room">
            <LiveRoom view={world} choice={choice} onPick={() => {}} label={label} fallback={<FlatRoom view={view} label={label} />} />
          </div>
          <Hud phase={view.moment.title} round={view.moment.round} muted={sound.muted} onMute={sound.toggleMute} menu={<p className="hud-note">You are out of the game, watching as a ghost: you see what every seat knows, hidden information included.</p>} />
          <div className="shell-controls">
            <p className="sr-only" role="status">
              You are out of the game, and watching as a ghost. You can see what every seat knows, hidden information included.
            </p>
            <div role="group" aria-label="Seats to watch" className="ghost-seats">
              {seatButtons}
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  return (
    <section className="ghost" data-testid="ghost" aria-label="Watching as a ghost">
      <p className="notice" role="status">
        You are out of the game, and watching as a ghost. You can see what every seat knows, hidden information included. The game goes on without
        you.
      </p>
      <div role="group" aria-label="Seats to watch" className="ghost-seats">
        {seatButtons}
      </div>
      {view && seat ? (
        <div className="live-room">
          {world ? (
            <LiveRoom view={world} choice={choice} onPick={() => {}} label={label} fallback={<FlatRoom view={view} label={label} />} />
          ) : (
            <FlatRoom view={view} label={label} />
          )}
        </div>
      ) : (
        <p className="notice" data-testid="ghost-empty">
          {seat ? `${seat.name} has not been told anything yet.` : 'There is nothing to watch yet.'}
        </p>
      )}
    </section>
  );
}
