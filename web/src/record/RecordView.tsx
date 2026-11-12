import { useMemo } from 'react';
import './record.css';
import type { GameLog } from '../../../src/engine/types.js';
import { describeStep, stepDurationMs } from '../replay/describe.js';
import { buildSteps, seatsAt } from '../replay/timeline.js';
import { seatStepMs, seatTimeline, seatView } from '../perspective/seatView.js';
import { Room } from '../scene/Room.js';
import { Table } from '../Table.js';
import { usePlayback } from '../usePlayback.js';
import { Faces } from './Faces.js';
import { textScale } from './fit.js';
import type { RecordParams } from './params.js';
import { stepsForRange } from './range.js';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface Props {
  log: GameLog;
  params: RecordParams;
}

/** The clip camera: no controls, fixed aspect, autoplay at reading speed, one URL per clip. */
export function RecordView({ log, params }: Props) {
  const steps = useMemo(() => buildSteps(log), [log]);
  const clip = useMemo(() => {
    const range = stepsForRange(steps, params.from, params.to);
    if (!params.seats) return range;
    // Filming from a seat: walk only the steps that show some filmed seat something, so the length of the clip does not follow
    // hidden turns (a seat that is not told about the traitors' night must not sit through it).
    const keep = new Set(params.seats.flatMap((name) => (log.cast.some((c) => c.name === name) ? seatTimeline(log, steps, name) : [])));
    return keep.size === 0 ? range : range.filter((s) => keep.has(steps.indexOf(s)));
  }, [steps, log, params.from, params.to, params.seats]);
  const views = useMemo(() => clip.map((s) => describeStep(s, log)), [clip, log]);
  const durations = useMemo(
    // setTimeout overflows above 2^31-1 ms and then fires at once, so cap the hold.
    () =>
      clip.map((s, i) => {
        const base = params.seats
          ? Math.max(...params.seats.map((n) => (log.cast.some((c) => c.name === n) ? seatStepMs(seatView(log, steps, steps.indexOf(s), n)) : 0)))
          : stepDurationMs(views[i]!);
        return Math.min(MAX_TIMEOUT_MS, Math.max(50, Math.round(base / params.speed)));
      }),
    [clip, views, log, steps, params.speed, params.seats],
  );
  const { index, playing } = usePlayback(durations, { autoStart: params.faces === null && clip.length > 0 });

  if (params.faces !== null) {
    return (
      <div className="rec" data-aspect={params.aspect} data-done="true">
        <div className="rec-stage" data-testid="stage" data-mode="faces" role="region" aria-label="Round Table clip">
          <Faces log={log} turnId={params.faces} />
        </div>
      </div>
    );
  }
  if (clip.length === 0) {
    return (
      <p className="rec-error" role="alert">
        No steps between turn {params.from ?? 0} and turn {params.to ?? 'the end'}. This log has turns 0 to {log.turns.length - 1}.
      </p>
    );
  }

  const unknownSeat = params.seats?.find((name) => !log.cast.some((c) => c.name === name));
  if (unknownSeat !== undefined) {
    return (
      <p className="rec-error" role="alert">
        There is no seat called {unknownSeat}. The seats are {log.cast.map((c) => c.name).join(', ')}.
      </p>
    );
  }

  const step = clip[index] as (typeof clip)[number];
  const view = views[index]!;
  const seats = seatsAt(log, steps, steps.indexOf(step));
  const done = !playing && index === clip.length - 1;
  const turnId = step.kind === 'turn' ? step.turn.id : '';

  if (params.seats) {
    // One shared step for every seat, so a split view always shows the same moment.
    const at = steps.indexOf(step);
    return (
      <div className="rec" data-aspect={params.aspect} data-done={done} data-step={index} data-turn={turnId}>
        <div className="rec-stage" data-testid="stage" data-mode="seats" data-count={params.seats.length} role="region" aria-label="Round Table clip">
          {params.seats.map((name) => (
            <div key={name} className="rec-seat-view" data-seat={name}>
              <Room view={seatView(log, steps, at, name)} label={`The room from ${name}'s chair`} />
              <p className="rec-seat-label">{name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rec" data-aspect={params.aspect} data-done={done} data-step={index} data-turn={turnId}>
      <div className="rec-stage" data-testid="stage" role="region" aria-label="Round Table clip">
        <div className="rec-table">
          <Table seats={seats} view={{ ...view, bubble: null, card: null }} />
        </div>
        <div className="rec-caption" data-testid="caption">
          <p className="rec-kicker">
            {step.section.title}
            {step.kind !== 'result' && ` · Round ${step.section.round}`}
          </p>
          {view.speaker && view.bubble && <p className="rec-who">{view.speaker}</p>}
          {view.bubble && (
            <p className="rec-text" style={{ fontSize: `calc(var(--rec-text) * ${textScale(view.bubble.text.length)})` }}>
              {view.bubble.text}
            </p>
          )}
          {view.card && (
            <>
              <p className="rec-who">{view.card.title}</p>
              <p className="rec-text" style={{ fontSize: `calc(var(--rec-text) * ${textScale(view.card.body.length)})` }}>
                {view.card.body}
              </p>
            </>
          )}
          {view.bubble && view.rows.filter((r) => r.label === 'Suspects').map((r) => (
            <p key={r.label} className="rec-sub">
              Suspects {r.value}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
