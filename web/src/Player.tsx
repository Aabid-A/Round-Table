import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameLog } from '../../src/engine/types.js';
import { buildContext } from '../../src/log/highlights/context.js';
import { Controls } from './Controls.js';
import { Details } from './Details.js';
import { actionForKey } from './keys.js';
import { perspectiveFromSearch, searchWithPerspective, type Perspective } from './perspective/params.js';
import { spectatorView } from './perspective/spectatorView.js';
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
  onReload?: () => void;
  /** The game is still being played and `log` is as much of it as this watcher may see: no result step, and the replay follows new steps as they arrive. */
  live?: boolean;
  /** What to show when the address does not say (a watcher opens in the all-seeing room). */
  initial?: Perspective;
}

const announcement = (view: StepView): string =>
  view.card ? `${view.card.title}. ${view.card.body}` : view.bubble && view.speaker ? `${view.speaker}: ${view.bubble.text}` : '';

/**
 * What a screen reader is told in the room: only what the view holds, never the public step. A seat's view has no notes and no
 * whispers; the all-seeing view adds the speaker's private notes and who whispered to whom, which the drawing shows as a
 * panel and a line a screen reader cannot see.
 */
const roomAnnouncement = (view: SceneView): string => {
  const { title, speaker, text, thought } = view.moment;
  const parts = [text ? `${title}. ${speaker ? `${speaker}: ` : ''}${text}` : title];
  if (thought) parts.push(`Private notes: ${thought}`);
  for (const w of view.whispers) parts.push(`Whisper from ${w.from} to ${w.to}: ${w.text}`);
  return parts.join('. ');
};

/** Plays one game log like an episode. */
export function Player({ log, onReload, live = false, initial }: Props) {
  const steps = useMemo(() => buildSteps(log, { partial: live }), [log, live]);
  const views = useMemo(() => steps.map((s) => describeStep(s, log)), [steps, log]);
  const [showNotes, setShowNotes] = useState(false);
  // The seat the viewer sits in, or null for the public table.
  const [perspective, setPerspective] = useState<Perspective>(() => {
    const fromAddress = perspectiveFromSearch(window.location.search, log.cast);
    return fromAddress.kind === 'table' && initial ? initial : fromAddress;
  });
  const seat = perspective.kind === 'seat' ? perspective.name : null;
  const spectating = perspective.kind === 'spectator';
  const ctx = useMemo(() => buildContext(log), [log]);
  // The steps this viewer walks: all of them at the public table, a seat's own list when seated (see seatTimeline).
  const timeline = useMemo(() => (seat === null ? steps.map((_, i) => i) : seatTimeline(log, steps, seat)), [log, steps, seat]);
  const durations = useMemo(
    () => timeline.map((i) => (seat === null ? stepDurationMs(views[i]!) : seatStepMs(seatView(log, steps, i, seat)))),
    [timeline, views, log, steps, seat],
  );
  const { index: pos, playing, seek, jump, next, prev, toggle, restart } = usePlayback(durations);
  const at = Math.min(pos, timeline.length - 1);
  const index = timeline[at] ?? 0;
  // A live watcher who was at the newest step stays there as more of the game arrives.
  const seen = useRef({ length: timeline.length, atEnd: pos >= timeline.length - 1 });
  useEffect(() => {
    const grew = timeline.length > seen.current.length;
    const follow = live && grew && seen.current.atEnd;
    if (follow) seek(timeline.length - 1);
    seen.current = { length: timeline.length, atEnd: follow || pos >= timeline.length - 1 };
  }, [live, timeline.length, pos, seek]);
  // The step the viewer last chose themselves. Switching seats stands on the nearest step at or before it in the new list, and
  // going back lands on it again, so a round trip does not drift when the step is empty for the seat.
  const anchor = useRef(0);
  useEffect(() => {
    if (pos !== positionAtOrBefore(timeline, anchor.current)) anchor.current = timeline[Math.min(pos, timeline.length - 1)] ?? 0;
  }, [pos, timeline]);
  const choose = (p: Perspective): void => {
    const next = p.kind === 'seat' ? seatTimeline(log, steps, p.name) : steps.map((_, i) => i);
    // Change the perspective and the position in one update, so playback never sees the old position against the new list.
    setPerspective(p);
    jump(positionAtOrBefore(next, anchor.current));
    window.history.replaceState(null, '', `${window.location.pathname}${searchWithPerspective(window.location.search, p)}${window.location.hash}`);
  };
  const sit = (name: string | null): void => choose(name === null ? { kind: 'table' } : { kind: 'seat', name });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      const action = actionForKey(e.key, t && { tagName: t.tagName, type: (t as HTMLInputElement).type, isContentEditable: t.isContentEditable }, { spectate: true });
      if (!action) return;
      e.preventDefault();
      if (e.repeat && action === 'toggle') return; // holding space must not flip play/pause at key-repeat speed
      if (action === 'next') next();
      else if (action === 'prev') prev();
      else if (action === 'spectate') choose({ kind: 'spectator' });
      else toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const step = steps[index]!;
  const view = views[index]!;
  const seats = seatsAt(log, steps, index);
  const sv = seat !== null ? seatView(log, steps, index, seat) : spectating ? spectatorView(log, steps, index, ctx) : null;

  return (
    <main className="app" data-step={seat === null && !spectating ? index : pos} data-seat={seat ?? ''} data-view={perspective.kind}>
      <header className="topbar">
        <h1>Round Table</h1>
        <span className="muted">
          {live ? '' : `seed ${log.seed} · `}{log.cast.length} players
        </span>
      </header>
      {/* Spoken when stepping by hand; silent during autoplay so it does not talk over itself. */}
      <p className="sr-only" role="status" data-testid="announcement">
        {playing ? '' : sv ? roomAnnouncement(sv) : announcement(view)}
      </p>
      <h2 className="section-title" data-testid="section">
        {sv ? sv.moment.title : step.section.title}
        {step.kind !== 'result' && <span className="round">Round {step.section.round}</span>}
      </h2>
      <div className="layout">
        {sv ? (
          <div className="seat-room">
            <Room view={sv} onSit={sit} label={seat !== null ? `The room from ${seat}'s chair` : 'The room, seen by a spectator'} />
          </div>
        ) : step.kind === 'result' ? (
          <ResultScreen log={log} seats={seats} onRestart={restart} />
        ) : (
          <Table seats={seats} view={view} />
        )}
        {perspective.kind === 'table' && step.kind !== 'result' && <Details view={view} showNotes={showNotes} />}
      </div>
      <section className="sit" aria-label="Seat">
        <div className="sit-row">
          <label htmlFor="view-select">View</label>
          <select
            id="view-select"
            value={seat ?? (spectating ? '@all' : '')}
            onChange={(e) => (e.target.value === '@all' ? choose({ kind: 'spectator' }) : sit(e.target.value === '' ? null : e.target.value))}
          >
            <option value="">The public table</option>
            <option value="@all">All-seeing room (spoilers)</option>
            {log.cast.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">
          {seat !== null
            ? `You see only what ${seat} knew. Press A for the all-seeing room, or choose another view; the game stays at this moment.`
            : spectating
              ? 'You see everything. Click a seat to see the game as that player. The camera follows the speaker; press A to come back here.'
              : 'Choose the all-seeing room, or sit in a seat to see the game as that player: only what they were told.'}
        </p>
      </section>
      <Controls
        index={pos}
        count={timeline.length}
        playing={playing}
        showNotes={showNotes}
        notesLocked={perspective.kind !== 'table'}
        onPrev={prev}
        onNext={next}
        onToggle={toggle}
        onSeek={seek}
        onNotes={setShowNotes}
        {...(onReload ? { onReload } : {})}
      />
    </main>
  );
}
