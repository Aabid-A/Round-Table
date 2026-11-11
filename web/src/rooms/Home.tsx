import { useId, useState } from 'react';
import { checkCreate, checkJoin, MAX_COST_USD, type CreateMessage } from './forms.js';

interface Props {
  /** The code from an invite link, if the person arrived through one. */
  inviteCode: string | null;
  /** What the server last refused, or that the connection is down. */
  serverError: string | null;
  offline: boolean;
  onDismissError: () => void;
  onCreate: (message: CreateMessage) => void;
  onJoin: (message: { t: 'join'; code: string; name: string }) => void;
}

/** Make a room, or join one by code. An invite link opens on the join form with the code filled in. */
export function Home({ inviteCode, serverError, offline, onDismissError, onCreate, onJoin }: Props) {
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(inviteCode === null);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(inviteCode ?? '');
  const [name, setName] = useState('');
  const [real, setReal] = useState(false);
  const [key, setKey] = useState('');
  const [models, setModels] = useState('');
  const [cap, setCap] = useState('1.00');

  // One primary button on the page: joining when the person came from an invite, making a room otherwise.
  const joinIsPrimary = inviteCode !== null;
  const shown = problem ?? serverError;
  const clear = (): void => {
    setProblem(null);
    if (serverError) onDismissError();
  };

  const join = (): void => {
    const checked = checkJoin({ code: joinCode, name: joinName });
    if (!checked.ok) return setProblem(checked.message);
    clear();
    onJoin(checked.value);
  };
  const create = (): void => {
    const checked = checkCreate({ name, real, key, models, cap });
    if (!checked.ok) return setProblem(checked.message);
    clear();
    setKey(''); // the key leaves this page with the message; the page keeps no copy
    onCreate(checked.value);
  };

  return (
    <main className="loader rooms">
      <h1>Play with friends</h1>
      <p className="muted">
        Open a room, share the code, and play together. Up to eight people can join, and AIs fill the empty seats. Nobody needs an account.
      </p>

      {offline && (
        <p className="notice notice-error" role="alert" data-testid="offline">
          Cannot reach the room server. Check your connection; this page keeps trying.
        </p>
      )}
      {shown && (
        <p className="notice notice-error" role="alert" id={`${id}-err`} data-testid="room-error">
          {shown}
        </p>
      )}

      <section aria-labelledby={`${id}-join`} className="room-section">
        <h2 id={`${id}-join`}>{inviteCode ? `Join room ${inviteCode}` : 'Join a room'}</h2>
        <form
          className="setup"
          aria-describedby={shown ? `${id}-err` : undefined}
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          {!inviteCode && (
            <label className="field">
              Room code
              <input type="text" value={joinCode} maxLength={5} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(e) => (setJoinCode(e.target.value), clear())} />
            </label>
          )}
          <label className="field">
            Your name at the table
            <input type="text" value={joinName} maxLength={20} autoComplete="off" onChange={(e) => (setJoinName(e.target.value), clear())} />
          </label>
          <button type="submit" className={joinIsPrimary ? 'btn btn-primary' : 'btn'}>
            Join room
          </button>
        </form>
      </section>

      {inviteCode && !showCreate && (
        <p>
          <button type="button" className="btn" onClick={() => setShowCreate(true)}>
            Make my own room instead
          </button>
        </p>
      )}

      {showCreate && (
        <section aria-labelledby={`${id}-create`} className="room-section">
          <h2 id={`${id}-create`}>Make a room</h2>
          <form
            className="setup"
            aria-describedby={shown ? `${id}-err` : undefined}
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label className="field">
              Your name at the table
              <input type="text" value={name} maxLength={20} autoComplete="off" onChange={(e) => (setName(e.target.value), clear())} />
            </label>
            <fieldset className="choices">
              <legend>Who fills the empty seats?</legend>
              <label className="choice" data-on={!real}>
                <input type="radio" name={`${id}-ai`} checked={!real} onChange={() => (setReal(false), clear())} />
                Practice AIs (no key needed)
              </label>
              <label className="choice" data-on={real}>
                <input type="radio" name={`${id}-ai`} checked={real} onChange={() => (setReal(true), clear())} />
                Real models through OpenRouter
              </label>
            </fieldset>
            {real && (
              <>
                <label className="field">
                  Your OpenRouter key
                  <input type="password" value={key} autoComplete="new-password" spellCheck={false} onChange={(e) => (setKey(e.target.value), clear())} />
                </label>
                <p className="hint" data-testid="key-note">
                  The key goes to the room server and is held in memory for this room only. It is never shown to other players, never put in the
                  game log, and forgotten when the game ends.
                </p>
                <label className="field">
                  Model IDs, one per line, 1 to 7 (the AI seats take them in turn)
                  <textarea rows={5} value={models} spellCheck={false} onChange={(e) => (setModels(e.target.value), clear())} />
                </label>
                <label className="field">
                  Spend cap in US dollars, up to {MAX_COST_USD}. The game stops before a call that could pass it.
                  <input type="text" inputMode="decimal" value={cap} onChange={(e) => (setCap(e.target.value), clear())} />
                </label>
              </>
            )}
            <button type="submit" className={joinIsPrimary ? 'btn' : 'btn btn-primary'}>
              Make room
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
