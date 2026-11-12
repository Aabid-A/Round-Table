import { useId, useState } from 'react';
import type { ServerMessage } from '../../../server/protocol.js';
import { inviteLink, watchLink } from './params.js';
import type { Identity } from './state.js';

type LobbyMessage = Extract<ServerMessage, { t: 'lobby' }>;

interface Props {
  me: Identity;
  lobby: LobbyMessage | null;
  serverError: string | null;
  onStart: () => void;
  onLeave: () => void;
}

/** Waiting room: the code and invite link to share, who is seated, and the host's Start button. */
export function Lobby({ me, lobby, serverError, onStart, onLeave }: Props) {
  const id = useId();
  const [copied, setCopied] = useState<string | null>(null);
  const link = inviteLink(window.location, me.code);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Invite link copied.');
    } catch {
      setCopied('Could not copy. Select the link and copy it by hand.');
    }
  };
  const host = lobby?.seats.find((s) => s.host)?.name ?? 'the host';
  const watch = me.host && me.watch ? watchLink(window.location, me.code, me.watch) : null;
  const copyWatch = async (): Promise<void> => {
    if (!watch) return;
    try {
      await navigator.clipboard.writeText(watch);
      setCopied('Watch link copied.');
    } catch {
      setCopied('Could not copy. Select the link and copy it by hand.');
    }
  };

  return (
    <main className="loader rooms" data-testid="lobby">
      <h1>
        Room <span className="room-code" data-testid="room-code">{me.code}</span>
      </h1>
      <p className="muted">Share the code or the link. Friends open it, pick a name and take a seat. Up to eight people can play.</p>

      {serverError && (
        <p className="notice notice-error" role="alert">
          {serverError}
        </p>
      )}

      <div className="field">
        <label htmlFor={`${id}-link`}>Invite link</label>
        <div className="invite">
          <input id={`${id}-link`} type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
          <button type="button" className="btn" onClick={() => void copy()}>
            Copy link
          </button>
        </div>
        <span className="hint" role="status">
          {copied ?? ''}
        </span>
      </div>

      {watch && (
        <div className="field" data-testid="watch-field">
          <label htmlFor={`${id}-watch`}>Read-only watch link</label>
          <div className="invite">
            <input id={`${id}-watch`} type="text" readOnly value={watch} onFocus={(e) => e.currentTarget.select()} data-testid="watch-link" />
            <button type="button" className="btn" onClick={() => void copyWatch()}>
              Copy watch link
            </button>
          </div>
          <span className="hint">Share it only with people who are not playing. It shows every role, note and whisper, one full round behind the game.</span>
        </div>
      )}

      <section aria-labelledby={`${id}-seats`} className="room-section">
        <h2 id={`${id}-seats`}>At the table{lobby ? ` (${lobby.seats.length} of ${lobby.maxHumans})` : ''}</h2>
        {lobby === null ? (
          <p className="notice" role="status">
            Joining the room…
          </p>
        ) : (
          <>
            <ul className="seats" aria-label="People in this room" data-testid="seats">
              {lobby.seats.map((s) => (
                <li key={s.name} data-connected={s.connected}>
                  <strong>{s.name}</strong>
                  {s.name === me.you ? ' (you)' : ''}
                  {s.host ? <span className="tag">host</span> : null}
                  {!s.connected ? <span className="tag tag-off">offline</span> : null}
                </li>
              ))}
            </ul>
            {lobby.aliases && (
              <p className="notice" data-testid="alias-note">
                Human or AI? Everyone plays under an alias, and you will be told yours when the game starts. At the end you guess which seats were AIs.
              </p>
            )}
            {lobby.ghosts && (
              <p className="notice" data-testid="ghosts-note">
                Ghosts are on. If you are murdered or banished you can keep watching, and you will see what every seat knows, hidden information included.
              </p>
            )}
            {lobby.spectators && !me.host && (
              <p className="muted" data-testid="spectators-note">
                This room has a read-only watch link, one full round behind the game, that the host can share.
              </p>
            )}
            <p className="muted" data-testid="ai-seats">
              {lobby.aiSeats} AI seat{lobby.aiSeats === 1 ? '' : 's'} will be filled by {lobby.mode === 'mock' ? 'practice AIs' : 'real models'}.
            </p>
          </>
        )}
      </section>

      <div className="controls-row">
        {me.host ? (
          <button type="button" className="btn btn-primary" onClick={onStart} disabled={lobby === null}>
            Start the game
          </button>
        ) : (
          <p className="notice" role="status" data-testid="waiting-for-host">
            Waiting for {host} to start the game.
          </p>
        )}
        <button type="button" className="btn" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </main>
  );
}
