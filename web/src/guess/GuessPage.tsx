import { useEffect, useMemo, useState } from 'react';
import './guess.css';
import type { GameLog } from '../../../src/engine/types.js';
import { Details } from '../Details.js';
import { actionForKey } from '../keys.js';
import { loadFromName } from '../load.js';
import { describeStep, stepDurationMs, type StepView } from '../replay/describe.js';
import { buildSteps, seatsAt } from '../replay/timeline.js';
import { Table } from '../Table.js';
import { EpisodesPage } from './EpisodesPage.js';
import { pickEpisode } from './episodes.js';
import { loadEpisodeIndex } from './loadIndex.js';
import { parseGuessParams } from './params.js';
import { PickPanel } from './PickPanel.js';
import { pickSetups, scoreGuesses } from './score.js';
import { ScorePage } from './ScorePage.js';
import { buildGuessSteps } from './steps.js';
import { useGuessPlayback } from './useGuessPlayback.js';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; log: GameLog; name: string; episode: number | null };

const EMPTY: StepView = { speaker: null, target: null, bubble: null, card: null, rows: [], tally: [], notes: null, fallback: false };

/** ?mode=guess: pick the traitors as the episode plays. With no log or episode named, it shows the episode list. */
export function GuessPage() {
  const parsed = parseGuessParams(window.location.search);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    document.title = 'Round Table: guess the traitor';
    if (!parsed.ok) return;
    const { log, episode, label, date } = parsed.params;
    const fail = (message: string): void => setState({ kind: 'error', message });
    const play = async (name: string, number: number | null): Promise<void> => {
      const r = await loadFromName(name, import.meta.env.BASE_URL);
      setState(r.ok ? { kind: 'ready', log: r.log, name, episode: number } : { kind: 'error', message: r.message });
    };
    if (log !== null) void play(log, label);
    else if (episode !== null) {
      void loadEpisodeIndex(import.meta.env.BASE_URL).then((r) => {
        if (!r.ok) return fail(r.message);
        const today = date !== null ? new Date(`${date}T12:00:00Z`) : new Date();
        const entry = pickEpisode(r.index, episode, today);
        if (!entry) return fail(episode.kind === 'number' ? `There is no episode ${episode.number}.` : 'There are no episodes yet.');
        void play(entry.name, entry.number);
      });
    }
    // The address does not change while the page is open.
  }, []);

  if (!parsed.ok) return <p className="rec-error" role="alert">{parsed.message}</p>;
  if (parsed.params.log === null && parsed.params.episode === null) return <EpisodesPage />;
  if (state.kind === 'error') {
    return (
      <main className="loader">
        <p className="notice notice-error" role="alert">
          {state.message}
        </p>
        <p>
          <a className="btn" href="?page=episodes">
            See the episodes
          </a>
        </p>
      </main>
    );
  }
  if (state.kind === 'loading') return <p className="rec-error" role="status">Loading the episode…</p>;
  return <GuessPlayer key={state.name} log={state.log} name={state.name} episode={state.episode} />;
}

interface PlayerProps {
  log: GameLog;
  name: string;
  episode: number | null;
}

function GuessPlayer({ log, name, episode }: PlayerProps) {
  const steps = useMemo(() => buildGuessSteps(log), [log]);
  const all = useMemo(() => buildSteps(log), [log]);
  const setups = useMemo(() => pickSetups(log, steps), [log, steps]);
  const views = useMemo(() => steps.map((s) => (s.kind === 'play' ? describeStep(s.step, log) : EMPTY)), [steps, log]);
  const durations = useMemo(() => steps.map((s, i) => (s.kind === 'play' ? stepDurationMs(views[i]!) : s.kind === 'pick' ? 1000 : 0)), [steps, views]);
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const isLockedOut = (i: number): boolean => {
    const s = steps[i];
    return s?.kind === 'pick' && !picks[s.round];
  };
  const { index, playing, canNext, next, prev, toggle, restart } = useGuessPlayback(durations, isLockedOut);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('form')) return; // arrows and space belong to the picking form
      const action = actionForKey(e.key, t && { tagName: t.tagName, type: (t as HTMLInputElement).type, isContentEditable: t.isContentEditable });
      if (!action) return;
      e.preventDefault();
      if (e.repeat && action === 'toggle') return;
      if (action === 'next') next();
      else if (action === 'prev') prev();
      else toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggle]);

  const step = steps[index]!;
  const score = useMemo(() => scoreGuesses(log, steps, picks), [log, steps, picks]);
  const link = `${window.location.origin}${window.location.pathname}?mode=guess&log=${encodeURIComponent(name)}${episode !== null ? `&episode=${episode}` : ''}`;
  const seats = seatsAt(log, all, step.at);
  const title = step.kind === 'play' ? step.step.section.title : step.kind === 'pick' ? 'Your picks' : 'Score';
  const round = step.kind === 'score' ? null : step.kind === 'pick' ? step.round : step.step.section.round;
  const setup = step.kind === 'pick' ? setups.find((s) => s.round === step.round) : undefined;

  return (
    <main className="app">
      <header className="topbar">
        <h1>Guess the traitor</h1>
        <span className="muted">{episode !== null ? `Episode ${episode}` : name}</span>
      </header>
      <h2 className="section-title" data-testid="section">
        {title}
        {round !== null && <span className="round">Round {round}</span>}
      </h2>

      {step.kind === 'score' ? (
        <ScorePage log={log} score={score} episode={episode} link={link} onAgain={() => { setPicks({}); restart(); }} />
      ) : (
        <div className="layout">
          <Table seats={seats} view={views[index]!} />
          {step.kind === 'pick' && setup ? (
            <PickPanel key={step.round} setup={setup} locked={picks[step.round] ?? null} onLock={(names) => setPicks((p) => ({ ...p, [step.round]: names }))} />
          ) : (
            <Details view={views[index]!} showNotes={false} />
          )}
        </div>
      )}

      {step.kind !== 'score' && (
        <section className="controls" aria-label="Playback">
          <div className="controls-row">
            <button type="button" className="btn" onClick={prev} disabled={index === 0}>
              Previous
            </button>
            <button type="button" className="btn btn-primary" onClick={toggle} disabled={!canNext}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="btn" onClick={next} disabled={!canNext}>
              Next
            </button>
            <span className="muted" aria-hidden="true">
              {index + 1} / {steps.length}
            </span>
          </div>
          <p className="hint">
            {isLockedOut(index) ? 'Lock your picks to carry on.' : 'Space plays or pauses. Left and right arrows step. Private notes and roles stay hidden until the end.'}
          </p>
        </section>
      )}
    </main>
  );
}
