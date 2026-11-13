import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { runGame } from '../../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../../src/players/mock.js';
import { buildPrompt } from '../../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../../src/prompts/system.js';
import { chooseQuality, qualityFromSearch, type Quality } from '../scene/stage/quality.js';
import { cueForStage } from './cues.js';
import { paceFromSearch } from './params.js';
import { initial, reduce, stageMs, viewOf } from './machine.js';
import { SliceFallback } from './SliceFallback.js';
import { SliceHud } from './SliceHud.js';
import { readMuted, Sound, writeMuted } from './sound.js';
import { scriptFromLog, SLICE_SEED, type SliceScript } from './script.js';

const SliceScene = lazy(() => import('../scene/SliceScene.js'));

/** ?mode=slice: one round table, in WebGL, on a fixed mock game. */
export function SlicePage() {
  const [script, setScript] = useState<SliceScript | null>(null);
  useEffect(() => {
    document.title = 'Round Table: one round table';
    void runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: SLICE_SEED, players: createMockPlayers(MOCK_CAST, SLICE_SEED), buildPrompt, systemPrompt: SYSTEM_PROMPT }).then((log) => setScript(scriptFromLog(log)));
  }, []);
  return script ? <Slice script={script} /> : <p className="notice" role="status">Setting the table…</p>;
}

function hasWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function Slice({ script }: { script: SliceScript }) {
  const [state, dispatch] = useReducer((s: ReturnType<typeof initial>, a: Parameters<typeof reduce>[1]) => reduce(s, a, script), undefined, initial);
  const view = useMemo(() => viewOf(state, script), [state, script]);
  const [quality, setQuality] = useState<Quality>(() => qualityFromSearch(window.location.search) ?? 'high');
  const fixed = qualityFromSearch(window.location.search) !== null;
  const frames = useRef<number[]>([]);
  const onFrame = (ms: number): void => {
    if (fixed) return;
    frames.current.push(ms);
    if (frames.current.length === 45) setQuality(chooseQuality(frames.current.slice(5)));
  };
  const noGl = useMemo(() => new URLSearchParams(window.location.search).get('fallback') === '1' || !hasWebGl2(), []);
  const pace = useMemo(() => paceFromSearch(window.location.search), []);
  const sound = useRef<Sound | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const startSound = (): void => {
    sound.current ??= new Sound(muted);
    sound.current.start();
  };
  useEffect(() => {
    const cue = cueForStage(state.stage);
    if (cue) sound.current?.play(cue);
  }, [state.stage]);
  const toggleMute = (): void => {
    startSound();
    const m = !muted;
    setMuted(m);
    writeMuted(m);
    sound.current?.setMuted(m);
  };
  useEffect(() => {
    const ms = stageMs(state.stage);
    if (ms === null) return;
    const t = setTimeout(() => dispatch({ t: 'advance' }), ms * pace);
    return () => clearTimeout(t);
  }, [state.stage]);
  return (
    <main className="slice" data-testid="slice" onPointerDown={startSound} onKeyDown={startSound} data-quality={quality} data-figures={view.figures.filter((f) => f.present).length} data-stage={state.stage.kind}>
      {noGl ? (
        <SliceFallback view={view} reason="This is the plain version of the round table. The 3D room needs WebGL." />
      ) : (
      <Suspense fallback={<p className="notice" role="status">Lighting the candles…</p>}>
        <SliceScene view={view} quality={quality} onFrame={onFrame} onHover={(seat) => dispatch({ t: 'hover', seat })} onPick={(seat) => dispatch({ t: 'select', seat })} />
      </Suspense>
      )}
      <SliceHud view={view} dispatch={dispatch} muted={muted} onMute={toggleMute} canSkip={stageMs(state.stage) !== null} />
      <p className={view.speech ? 'slice-caption sr-only' : 'slice-caption'} role="status" aria-live="polite">{view.announce}</p>
    </main>
  );
}
