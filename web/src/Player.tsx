import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameLog } from '../../src/engine/types.js';
import { Controls } from './Controls.js';
import { Details } from './Details.js';
import { actionForKey } from './keys.js';
import { searchWithSeat, seatFromSearch } from './perspective/params.js';
import { positionAtOrBefore, seatStepMs, seatTimeline, seatView } from './perspective/seatView.js';
import { describeStep, stepDurationMs, type StepView } from './replay/describe.js';
import { buildSteps, seatsAt } from './replay/timeline.js';
import { ResultScreen } from './ResultScreen.js';
import { Room } from './scene/Room.js';
import type { SceneView } from './scene/view.js';
import { Table } from './Table.js';
import { usePlayback } from './usePlayback.js';

interface Props {
  log: GameLog;
  onReload: () => void;
}

const announcement = (view: StepView): string =>
  view.card ? `${view.card.title}. ${view.card.body}` : view.bubble && view.speaker ? `${view.speaker}: ${view.bubble.text}` : '';

/** What a screen reader is told while seated: only the seat's own view, never the public step (which includes whispers and notes). */
const seatAnnouncement = (view: SceneView): string => {
  const { title, speaker, text } = view.moment;
  return text ? `${title}. ${speaker ? `${speaker}: ` : ''}${text}` : title;
};

/** Plays one game log like an episode. */
export function Player({ log, onReload }: Props) {
  const steps = useMemo(() => buildSteps(log), [log]);
  const views = useMemo(() => steps.map((s) => describeStep(s, log)), [steps, log]);
  const [showNotes, setShowNotes] = useState(false);
  // The seat the viewer sits in, or null for the public table.
  const [seat, setSeat] = useState<string | null>(() => seatFromSearch(window.location.search, log.cast));
  // The steps this viewer walks: all of them at the public table, a seat's own list when seated (see seatTimeline).
  const timeline = useMemo(() => (seat === null ? steps.map((_, i) => i) : seatTimeline(log, steps, seat)), [log, steps, seat]);
  const durations = useMemo(
    () => timeline.map((i) => (seat === null ? stepDurationMs(views[i]!) : seatStepMs(seatView(log, steps, i, seat)))),
    [timeline, views, log, steps, seat],
  );
  const { index: pos, playing, seek, jump, next, prev, toggle, restart } = usePlayback(durations);
  const at = Math.min(pos, timeline.length - 1);
  const index = timeline[at] ?? 0;
  // The step the viewer last chose themselves. Switching seats stands on the nearest step at or before it in the new list, and
  // going back lands on it again, so a round trip does not drift when the step is empty for the seat.
  const anchor = useRef(0);
  useEffect(() => {
    if (pos !== positionAtOrBefore(timeline, anchor.current)) anchor.current = timeline[Math.min(pos, timeline.length - 1)] ?? 0;
  }, [pos, timeline]);
  const sit = (name: string | null): void => {
    const next = name === null ? steps.map((_, i) => i) : seatTimeline(log, steps, name);
    // Change the seat and the position in one update, so playback never sees the old position against the new list.
    setSeat(name);
    jump(positionAtOrBefore(next, anchor.current));
    window.history.replaceState(null, '', `${window.location.pathname}${searchWithSeat(window.location.search, name)}${window.location.hash}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      const action = actionForKey(e.key, t && { tagName: t.tagName, type: (t as HTMLInputElement).type, isContentEditable: t.isContentEditable });
      if (!action) return;
      e.preventDefault();
      if (e.repeat && action === 'toggle') return; // holding space must not flip play/pause at key-repeat speed
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
  const sv = seat !== null ? seatView(log, steps, index, seat) : null;

  return (
    <main className="app" data-step={seat === null ? index : pos} data-seat={seat ?? ''}>
      <header className="topbar">
        <h1>Round Table</h1>
        <span className="muted">
          seed {log.seed} · {log.cast.length} players
        </span>
      </header>
      {/* Spoken when stepping by hand; silent during autoplay so it does not talk over itself. */}
      <p className="sr-only" role="status" data-testid="announcement">
        {playing ? '' : sv ? seatAnnouncement(sv) : announcement(view)}
      </p>
      <h2 className="section-title" data-testid="section">
        {sv ? sv.moment.title : step.section.title}
        {step.kind !== 'result' && <span className="round">Round {step.section.round}</span>}
      </h2>
      <div className="layout">
        {seat !== null ? (
          <div className="seat-room">
            <Room view={sv!} onSit={sit} label={`The room from ${seat}'s chair`} />
          </div>
        ) : step.kind === 'result' ? (
          <ResultScreen log={log} seats={seats} onRestart={restart} />
        ) : (
          <Table seats={seats} view={view} />
        )}
        {seat === null && step.kind !== 'result' && <Details view={view} showNotes={showNotes} />}
      </div>
      <section className="sit" aria-label="Seat">
        <label>
          Sit in a seat
          <select value={seat ?? ''} onChange={(e) => sit(e.target.value === '' ? null : e.target.value)}>
            <option value="">Nobody: the public table</option>
            {log.cast.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          {seat === null
            ? 'Sit in a seat to see the game as that player: only what they were told.'
            : `You see only what ${seat} knew. Choose another seat, or "Nobody", and the game stays at this moment.`}
        </p>
      </section>
      <Controls
        index={pos}
        count={timeline.length}
        playing={playing}
        showNotes={showNotes}
        notesLocked={seat !== null}
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
