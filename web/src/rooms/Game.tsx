import { useEffect, useRef, useState } from 'react';
import type { HumanAnswer } from '../../../src/players/human.js';
import { publicPhase, type PublicPhase } from '../../../src/publicPhase.js';
import { HumanForm } from '../play/HumanForm.js';
import type { Identity, TurnInfo } from './state.js';
import { formatLeft, LOW_MS } from './time.js';

/** What is happening, in words that say nothing about who is acting. */
const PHASE_LINE: Record<PublicPhase, string> = {
  night: 'Night. The traitors are choosing.',
  whispers: 'Whispers. Players are sending private messages.',
  round_table: 'Round table. Players are speaking.',
  vote: 'The banishment vote is under way.',
  revote: 'The vote was tied. A revote is under way.',
  recruit: 'A traitor was banished. The traitors are deciding.',
  endgame_vote: 'Few players remain. They are voting to end the game or go on.',
};

export const phaseLine = (phase: PublicPhase | null): string => (phase === null ? 'The game is starting.' : PHASE_LINE[phase]);

interface Props {
  me: Identity;
  phase: PublicPhase | null;
  turn: TurnInfo | null;
  timedOut: boolean;
  offline: boolean;
  onAnswer: (turn: number, answer: HumanAnswer) => void;
  onLeave: () => void;
}

/** Counts down this person's turn. The server owns the real clock; this only shows it. */
function Clock({ timeoutMs }: { timeoutMs: number }) {
  const [left, setLeft] = useState(timeoutMs);
  useEffect(() => {
    const end = Date.now() + timeoutMs;
    const tick = setInterval(() => setLeft(Math.max(0, end - Date.now())), 250);
    return () => clearInterval(tick);
  }, [timeoutMs]);
  const low = left <= LOW_MS;
  return (
    <p className="clock" data-low={low} data-testid="clock">
      {low ? 'Hurry: ' : ''}
      Time left <strong>{formatLeft(left)}</strong>. If it runs out, a fallback move is made for you.
    </p>
  );
}

/** Takes focus when it appears, so focus is not lost when the form goes away. */
function Waiting({ phase }: { phase: PublicPhase | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <p ref={ref} tabIndex={-1} className="notice" role="status" data-testid="waiting" data-phase={phase ?? 'start'}>
      {phaseLine(phase)} Waiting for the others…
    </p>
  );
}

/** A person's seat during the game: the form on their turn, a status line otherwise. */
export function Game({ me, phase, turn, timedOut, offline, onAnswer, onLeave }: Props) {
  // After sending, the form is replaced by a waiting note until the server moves on. A turn the server sends again
  // (after a reconnect, when it never got the answer) is a new object, so the form opens again.
  const [sent, setSent] = useState<TurnInfo | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const open = turn !== null && sent !== turn;

  return (
    <main className="app play" data-testid="room-game">
      <header className="topbar">
        <h1>Round Table</h1>
        <span className="muted">You are {me.you}</span>
      </header>

      {offline && (
        <p className="notice notice-error" role="alert" data-testid="offline">
          You are offline. Reconnecting… Your turn waits for you until its time is up.
        </p>
      )}
      {timedOut && (
        <p className="notice" role="status" data-testid="timed-out">
          You ran out of time on your last turn, so a fallback move was made for you.
        </p>
      )}

      {open && turn ? (
        <>
          <Clock key={`clock-${turn.id}`} timeoutMs={turn.timeoutMs} />
          {turn.error && (
            <p className="notice notice-error" role="alert">
              {turn.error}
            </p>
          )}
          <HumanForm
            key={`form-${turn.id}`}
            request={{ system: '', user: turn.user, phase: turn.phase, player: me.you, options: turn.options }}
            turn={turn.id}
            onSubmit={(answer) => {
              setSent(turn);
              onAnswer(turn.id, answer);
            }}
          />
        </>
      ) : (
        <Waiting key={turn ? `sent-${turn.id}` : phase ?? 'start'} phase={turn ? publicPhase(turn.phase) : phase} />
      )}

      <div className="controls-row room-actions">
        {confirmLeave ? (
          <>
            <span>Leave the game? Fallback moves are made for your seat.</span>
            <button type="button" className="btn" onClick={onLeave}>
              Yes, leave
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setConfirmLeave(false)}>
              Stay
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmLeave(true)}>
            Leave game
          </button>
        )}
      </div>
    </main>
  );
}
