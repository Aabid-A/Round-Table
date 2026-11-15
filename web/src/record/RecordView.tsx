import { useMemo } from 'react';
import './record.css';
import type { GameLog } from '../../../src/engine/types.js';
import { describeStep, stepDurationMs } from '../replay/describe.js';
import { buildSteps, seatsAt } from '../replay/timeline.js';
import { buildContext } from '../../../src/log/highlights/context.js';
import { seatStepMs, seatTimeline, seatView } from '../perspective/seatView.js';
import { spectatorView } from '../perspective/spectatorView.js';
import { FlatRoom } from '../scene/FlatRoom.js';
import { BANISH_MS } from '../scene/fromScene.js';
import { useRoomChoice } from '../scene/host.js';
import { announcement, roomAnnouncement } from '../replay/announce.js';
import { momentWords } from '../replay/momentWords.js';
import { tableSceneView } from '../replay/tableScene.js';
import { RecordRoom } from './RecordRoom.js';
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
  // The clip is drawn in the 3D room where it can be; the flat clip stays as the fallback (see useRoomChoice).
  const choice = useRoomChoice(window.location.search);
  const steps = useMemo(() => buildSteps(log), [log]);
  const range = useMemo(() => stepsForRange(steps, params.from, params.to), [steps, params.from, params.to]);
  const ctx = useMemo(() => buildContext(log), [log]);
  const stepIndex = useMemo(() => new Map(steps.map((s, i) => [s, i] as const)), [steps]);
  const clip = useMemo(() => {
    if (!params.seats) return range;
    // Filming from a seat: walk only the steps that show some filmed seat something, so the length of the clip does not follow
    // hidden turns (a seat that is not told about the traitors' night must not sit through it).
    const keep = new Set(params.seats.flatMap((name) => (log.cast.some((c) => c.name === name) ? seatTimeline(log, steps, name) : [])));
    return keep.size === 0 ? range : range.filter((s) => keep.has(stepIndex.get(s) ?? -1));
  }, [range, stepIndex, steps, log, params.seats]);
  const views = useMemo(() => clip.map((s) => describeStep(s, log)), [clip, log]);
  const durations = useMemo(
    // setTimeout overflows above 2^31-1 ms and then fires at once, so cap the hold.
    () =>
      clip.map((s, i) => {
        const base = params.seats
          ? Math.max(...params.seats.map((n) => (log.cast.some((c) => c.name === n) ? seatStepMs(seatView(log, steps, stepIndex.get(s) ?? 0, n)) : 0)))
          : stepDurationMs(views[i]!);
        // In the room a banishment is staged beat by beat: the clip holds it until the mask has been turned over.
        const held = choice.room && s.kind === 'event' && s.event.type === 'banishment' ? Math.max(base, BANISH_MS) : base;
        return Math.min(MAX_TIMEOUT_MS, Math.max(50, Math.round(held / params.speed)));
      }),
    [clip, views, log, steps, stepIndex, params.speed, params.seats, choice.room],
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
  if (clip.length === 0 && range.length > 0) {
    return (
      <p className="rec-error" role="alert">
        Nothing between turn {params.from ?? 0} and turn {params.to ?? 'the end'} is shown to {params.seats?.join(' and ')}. Try a wider range.
      </p>
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
  const seats = seatsAt(log, steps, stepIndex.get(step) ?? 0);
  const done = !playing && index === clip.length - 1;
  const turnId = step.kind === 'turn' ? step.turn.id : '';

  // Each camera is the room from one scene view, keyed by the step so a banishment is staged afresh each time it is reached.
  const spectatorCamera = (at: number) => {
    const sv = spectatorView(log, steps, at, ctx);
    const label = 'The room, seen by a spectator';
    return <RecordRoom scene={sv} said={roomAnnouncement(sv)} caption={momentWords(sv)} stepKey={`spectator:${at}`} choice={choice} label={label} fallback={<FlatRoom view={sv} label={label} />} />;
  };
  const seatCamera = (at: number, name: string) => {
    const sv = seatView(log, steps, at, name);
    const label = `The room from ${name}'s chair`;
    const flat = (
      <>
        <FlatRoom view={sv} label={label} />
        <p className="rec-seat-label">{name}</p>
      </>
    );
    return <RecordRoom scene={sv} said={roomAnnouncement(sv)} stepKey={`${name}:${at}`} choice={choice} label={label} fallback={flat} />;
  };

  if (params.spectator) {
    // The all-seeing room, with the director's camera. Nothing is hidden, so every turn id may be shown.
    return (
      <div className="rec" data-aspect={params.aspect} data-done={done} data-step={index} data-turn={turnId} data-view="spectator">
        <div className="rec-stage" data-testid="stage" data-mode="seats" data-count="1" role="region" aria-label="Round Table clip">
          <div className="rec-seat-view">
            {spectatorCamera(stepIndex.get(step) ?? 0)}
          </div>
        </div>
      </div>
    );
  }

  if (params.seats) {
    // One shared step for every seat, so a split view always shows the same moment.
    const at = stepIndex.get(step) ?? 0;
    // data-turn is left empty here: a turn id from the full log would show where hidden turns were dropped.
    return (
      <div className="rec" data-aspect={params.aspect} data-done={done} data-step={index} data-turn="">
        <div className="rec-stage" data-testid="stage" data-mode="seats" data-count={params.seats.length} role="region" aria-label="Round Table clip">
          {params.seats.map((name) => (
            <div key={name} className="rec-seat-view" data-seat={name}>
              {seatCamera(at, name)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const at = stepIndex.get(step) ?? 0;
  if (choice.room && (step.kind !== 'result' || at > 0)) {
    // The public table in the room, filmed by the director: what was said is said in the room, with no caption laid over it.
    // The result is said over the table as it stood at the last step, every role now shown.
    const flat = <Table seats={seats} view={{ ...view, bubble: null, card: null }} />;
    const scene = step.kind === 'result' ? { ...tableSceneView(log, steps, at - 1, describeStep(steps[at - 1]!, log)), stage: null, seats: seats.map((s) => ({ name: s.name, model: s.model, status: s.status, role: s.revealedRole, mark: null })) } : tableSceneView(log, steps, at, view);
    return (
      <div className="rec" data-aspect={params.aspect} data-done={done} data-step={index} data-turn={turnId} data-view="table">
        <div className="rec-stage" data-testid="stage" data-mode="seats" data-count="1" role="region" aria-label="Round Table clip">
          <div className="rec-seat-view">
            <RecordRoom scene={scene} said={announcement(view)} stepKey={`table:${at}`} choice={choice} label="The round table" fallback={flat} />
          </div>
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
