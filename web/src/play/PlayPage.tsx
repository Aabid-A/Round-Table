import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './play.css';
import type { GameLog } from '../../../src/engine/types.js';
import type { PromptRequest } from '../../../src/players/player.js';
import { finalRoles } from '../replay/timeline.js';
import { HumanForm } from './HumanForm.js';
import { emptyAnswer, type HumanAnswer } from './human.js';
import { noteCardPng } from './noteCard.js';
import { aiFallbacks, notesAbout, type NoteAboutYou } from './notes.js';
import { seedFromSearch } from './params.js';
import { nameProblem, parseModels, runSolo, type SoloSetup } from './solo.js';

type Screen =
  | { kind: 'setup'; error: string | null }
  | { kind: 'playing'; human: string }
  | { kind: 'done'; human: string; log: GameLog }
  | { kind: 'failed'; message: string };

interface Pending {
  turn: number;
  request: PromptRequest;
  resolve: (a: HumanAnswer) => void;
}

const NOTES_SHOWN = 6;

const WINNER = { traitor: 'The traitors win', faithful: 'The faithfuls win' } as const;
const REASONS: Record<string, string> = {
  no_traitors: 'No traitors are left.',
  no_faithfuls: 'No faithfuls are left.',
  two_remaining: 'Two players remain.',
  endgame_vote: 'The survivors voted to end the game.',
  max_rounds: 'The last round was played.',
  cost_cap: 'The game was stopped by your spend cap.',
};

/** ?mode=play: take a seat at the table against seven AIs, in this tab. */
export function PlayPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'setup', error: null });
  const [pending, setPending] = useState<Pending | null>(null);
  const run = useRef(0);
  const asked = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const start = (setup: SoloSetup): void => {
    stopCurrent();
    const id = ++run.current;
    asked.current = 0;
    const controller = new AbortController();
    abort.current = controller;
    setScreen({ kind: 'playing', human: setup.humanName });
    const ask = (request: PromptRequest): Promise<HumanAnswer> =>
      new Promise((resolve) => {
        if (run.current === id) setPending({ turn: ++asked.current, request, resolve: (a) => (setPending(null), resolve(a)) });
      });
    runSolo(setup, ask, controller.signal).then(
      (log) => {
        if (run.current === id) setScreen({ kind: 'done', human: setup.humanName, log });
      },
      (e: unknown) => {
        if (run.current === id) setScreen({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
      },
    );
  };
  /** End any game in progress: cancel its network calls, let a waiting human turn go, and stop listening. */
  const stopCurrent = (): void => {
    run.current++;
    abort.current?.abort();
    abort.current = null;
    pendingRef.current?.resolve(emptyAnswer());
    setPending(null);
  };
  const quit = (): void => {
    stopCurrent();
    setScreen({ kind: 'setup', error: null });
  };

  useEffect(() => {
    document.title = 'Round Table: take a seat';
    return () => {
      run.current++;
      abort.current?.abort(); // leaving the page ends the game too
    };
  }, []);

  if (screen.kind === 'setup') return <Setup error={screen.error} onStart={start} />;
  if (screen.kind === 'failed') {
    return (
      <main className="loader">
        <p className="notice notice-error" role="alert">
          {screen.message}
        </p>
        <p>
          <button type="button" className="btn btn-primary" onClick={quit}>
            Back to setup
          </button>
        </p>
      </main>
    );
  }
  if (screen.kind === 'done') return <EndScreen human={screen.human} log={screen.log} onAgain={quit} />;
  return (
    <main className="app play">
      <header className="topbar">
        <h1>Take a seat</h1>
        <span className="muted">You are {screen.human}</span>
      </header>
      {pending ? (
        <HumanForm key={pending.turn} request={pending.request} turn={pending.turn} onSubmit={pending.resolve} />
      ) : (
        <Thinking />
      )}
      <p>
        <button type="button" className="btn" onClick={quit}>
          Quit this game
        </button>
      </p>
    </main>
  );
}

/** Shown while the AIs play. It takes focus when it appears, so focus is not lost when your form goes away. */
function Thinking() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <p ref={ref} tabIndex={-1} className="notice" role="status" data-testid="thinking">
      The AIs are thinking…
    </p>
  );
}

function Setup({ error, onStart }: { error: string | null; onStart: (s: SoloSetup) => void }) {
  const id = useId();
  const [name, setName] = useState('Sam');
  const [real, setReal] = useState(false);
  const [key, setKey] = useState('');
  const [models, setModels] = useState('');
  const [cap, setCap] = useState('1.00');
  const [problem, setProblem] = useState<string | null>(error);

  const submit = (): void => {
    const nameError = nameProblem(name);
    if (nameError) return setProblem(nameError);
    const seed = seedFromSearch(window.location.search);
    if (!real) return onStart({ humanName: name, seed, ai: { kind: 'mock' } });
    const parsed = parseModels(models);
    if (!parsed.ok) return setProblem(parsed.message);
    if (key.trim() === '') return setProblem('Paste your OpenRouter key.');
    const maxCostUsd = Number(cap);
    if (!(Number.isFinite(maxCostUsd) && maxCostUsd > 0)) return setProblem('The spend cap must be a number above 0.');
    const apiKey = key;
    setKey(''); // the key is no longer in the page; the game holds the only copy, in memory
    onStart({ humanName: name, seed, ai: { kind: 'openrouter', apiKey, models: parsed.models }, maxCostUsd });
  };

  return (
    <main className="loader">
      <h1>Take a seat</h1>
      <p className="muted">
        Play one game of Round Table against seven AIs, right here. You may be a traitor or a faithful. Your notes and theirs go into a
        log you can download.
      </p>
      {problem && (
        <p className="notice notice-error" role="alert" id={`${id}-err`}>
          {problem}
        </p>
      )}
      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-describedby={problem ? `${id}-err` : undefined}
      >
        <label className="field">
          Your name at the table (not an everyday word, so the AIs' notes about you can be found)
          <input type="text" value={name} maxLength={20} onChange={(e) => (setName(e.target.value), setProblem(null))} autoComplete="off" />
        </label>
        <fieldset className="choices">
          <legend>Who plays against you?</legend>
          <label className="choice" data-on={!real}>
            <input type="radio" name={`${id}-ai`} checked={!real} onChange={() => (setReal(false), setProblem(null))} />
            Practice AIs (no key, nothing leaves your browser)
          </label>
          <label className="choice" data-on={real}>
            <input type="radio" name={`${id}-ai`} checked={real} onChange={() => (setReal(true), setProblem(null))} />
            Real models through OpenRouter
          </label>
        </fieldset>
        {real && (
          <>
            <label className="field">
              Your OpenRouter key
              <input type="password" value={key} onChange={(e) => (setKey(e.target.value), setProblem(null))} autoComplete="new-password" spellCheck={false} />
            </label>
            <p className="hint" data-testid="key-note">
              The key stays in this tab&rsquo;s memory. It is sent only to OpenRouter, never saved, and not put in the game log. Closing or
              reloading the tab forgets it.
            </p>
            <label className="field">
              Seven model IDs, one per line (see openrouter.ai/models)
              <textarea rows={7} value={models} onChange={(e) => (setModels(e.target.value), setProblem(null))} spellCheck={false} />
            </label>
            <label className="field">
              Spend cap in US dollars. The game stops before a call that could pass it.
              <input type="text" inputMode="decimal" value={cap} onChange={(e) => (setCap(e.target.value), setProblem(null))} />
            </label>
          </>
        )}
        <button type="submit" className="btn btn-primary">
          Take a seat
        </button>
      </form>
    </main>
  );
}

function EndScreen({ human, log, onAgain }: { human: string; log: GameLog; onAgain: () => void }) {
  const roles = useMemo(() => finalRoles(log), [log]);
  const notes = useMemo(() => notesAbout(log, human), [log, human]);
  const r = log.result;
  const [note, setNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const fb = useMemo(() => aiFallbacks(log, human), [log, human]);
  const shown = showAll ? notes : notes.slice(0, NOTES_SHOWN);

  const save = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const card = async (n: NoteAboutYou): Promise<void> => {
    try {
      save(await noteCardPng(n, human), `round-table-${n.player}-round-${n.round}.png`);
      setNote('Card saved.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not make the card.');
    }
  };
  const download = (): void => {
    save(new Blob([`${JSON.stringify(log, null, 2)}\n`], { type: 'application/json' }), `round-table-solo-seed-${log.seed}.json`);
    setNote('Log saved.');
  };

  return (
    <main className="app play" data-testid="end">
      <header className="topbar">
        <h1>{r.winner === null ? 'Game stopped' : WINNER[r.winner]}</h1>
        <span className="muted">
          {REASONS[r.reason] ?? r.reason} · {r.rounds} round{r.rounds === 1 ? '' : 's'}
        </span>
      </header>
      {r.costCap && (
        <p className="notice" role="status">
          Spent ${r.costCap.spentUsd} of your ${r.costCap.maxUsd} cap.
        </p>
      )}

      {fb.fallbacks > 0 && (
        <p className="notice notice-error" role="alert" data-testid="fallback-notice">
          {fb.fallbacks} of {fb.turns} AI turns got no valid reply from their model, so a fallback move was used.
          {fb.fallbacks * 2 >= fb.turns ? ' If that is most of them, check your OpenRouter key and model IDs.' : ''}
        </p>
      )}

      <h2>Who was who</h2>
      <ul className="result-list" aria-label="Everyone's role" data-testid="reveal">
        {log.cast.map((c) => (
          <li key={c.name}>
            <strong>{c.name}</strong>
            {c.name === human ? ' (you)' : ''} · {roles[c.name] === 'traitor' ? 'Traitor' : 'Faithful'}
            <br />
            <span className="muted">{c.model}</span>
          </li>
        ))}
      </ul>

      <h2>What the AIs really thought of you</h2>
      {notes.length === 0 ? (
        <p className="notice" role="status" data-testid="no-notes">
          No AI wrote about you by name this game.
        </p>
      ) : (
        <ul className="missed" data-testid="notes-about-you">
          {shown.map((n) => (
            <li key={n.turnId}>
              <strong>
                {n.player} · {n.model} · round {n.round}
              </strong>
              {n.said !== '' && <span className="missed-said">Said: {n.said}</span>}
              <span className="notes">
                <strong>Thought, hidden from the players</strong>
                {n.thought}
              </span>
              <button type="button" className="btn" onClick={() => void card(n)} aria-label={`Download a card of what ${n.player} thought`}>
                Download card
              </button>
            </li>
          ))}
        </ul>
      )}

      {notes.length > NOTES_SHOWN && (
        <p>
          <button type="button" className="btn" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show fewer` : `Show all ${notes.length} notes`}
          </button>
        </p>
      )}

      <div className="controls-row">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="btn" onClick={download}>
          Download the game log
        </button>
      </div>
      <p className="hint" role="status" data-testid="end-note">
        {note ?? ''}
      </p>
    </main>
  );
}
