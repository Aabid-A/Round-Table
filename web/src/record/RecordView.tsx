import { useMemo } from 'react';
import './record.css';
import type { GameLog } from '../../../src/engine/types.js';
import { describeStep, stepDurationMs } from '../replay/describe.js';
import { buildSteps, seatsAt } from '../replay/timeline.js';
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
  const clip = useMemo(() => stepsForRange(steps, params.from, params.to), [steps, params.from, params.to]);
  const views = useMemo(() => clip.map((s) => describeStep(s, log)), [clip, log]);
  const durations = useMemo(
    // setTimeout overflows above 2^31-1 ms and then fires at once, so cap the hold.
    () => views.map((v) => Math.min(MAX_TIMEOUT_MS, Math.max(50, Math.round(stepDurationMs(v) / params.speed)))),
    [views, params.speed],
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

  const step = clip[index] as (typeof clip)[number];
  const view = views[index]!;
  const seats = seatsAt(log, steps, steps.indexOf(step));
  const done = !playing && index === clip.length - 1;
  const turnId = step.kind === 'turn' ? step.turn.id : '';

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
