import { useEffect, useMemo, useState } from 'react';
import type { GameLog } from '../../src/engine/types.js';
import { Controls } from './Controls.js';
import { Details } from './Details.js';
import { actionForKey } from './keys.js';
import { describeStep, stepDurationMs } from './replay/describe.js';
import { buildSteps, seatsAt } from './replay/timeline.js';
import { ResultScreen } from './ResultScreen.js';
import { Table } from './Table.js';
import { usePlayback } from './usePlayback.js';

interface Props {
  log: GameLog;
  onReload: () => void;
}

/** Plays one game log like an episode. */
export function Player({ log, onReload }: Props) {
  const steps = useMemo(() => buildSteps(log), [log]);
  const views = useMemo(() => steps.map((s) => describeStep(s, log)), [steps, log]);
  const durations = useMemo(() => views.map(stepDurationMs), [views]);
  const { index, playing, seek, next, prev, toggle, restart } = usePlayback(durations);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      const action = actionForKey(e.key, t && { tagName: t.tagName, type: (t as HTMLInputElement).type, isContentEditable: t.isContentEditable });
      if (!action) return;
      e.preventDefault();
      if (action === 'next') next();
      else if (action === 'prev') prev();
      else toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggle]);

  const step = steps[index]!;
  const view = views[index]!;
  const seats = seatsAt(log, steps, index);

  return (
    <main className="app">
      <header className="topbar">
        <h1>Round Table</h1>
        <span className="muted">
          seed {log.seed} · {log.cast.length} players
        </span>
      </header>
      <h2 className="section-title" data-testid="section" aria-live="polite">
        {step.section.title}
        {step.kind !== 'result' && <span className="round">Round {step.section.round}</span>}
      </h2>
      <div className="layout">
        {step.kind === 'result' ? (
          <ResultScreen log={log} seats={seats} onRestart={restart} />
        ) : (
          <Table seats={seats} view={view} />
        )}
        <Details view={view} showNotes={showNotes} />
      </div>
      <Controls
        index={index}
        count={steps.length}
        playing={playing}
        showNotes={showNotes}
        onPrev={prev}
        onNext={next}
        onToggle={toggle}
        onSeek={seek}
        onNotes={setShowNotes}
        onReload={onReload}
      />
    </main>
  );
}
