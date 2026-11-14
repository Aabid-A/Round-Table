import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { runGame } from '../../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../../src/players/mock.js';
import { buildPrompt } from '../../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../../src/prompts/system.js';
import { useInputKind } from '../scene/input.js';
import { chooseQuality, qualityFromSearch, type Quality } from '../scene/stage/quality.js';
import { cueForStage } from './cues.js';
import { paceFromSearch } from './params.js';
import { initial, reduce, stageMs, viewOf } from './machine.js';
import { SliceFallback } from './SliceFallback.js';
import { SliceHud } from './SliceHud.js';
import { readMuted, Sound, writeMuted } from '../scene/sound.js';
import { scriptFromLog, SLICE_SEED, type SliceScript } from './script.js';

const SliceScene = lazy(() => import('../scene/SliceScene.js'));

/** ?mode=slice: one round table, in WebGL, on a fixed mock game. */
export function SlicePage() {
  const [script, setScript] = useState<SliceScript | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    document.title = 'Round Table: one round table';
    let live = true;
    runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: SLICE_SEED, players: createMockPlayers(MOCK_CAST, SLICE_SEED), buildPrompt, systemPrompt: SYSTEM_PROMPT })
      .then((log) => live && setScript(scriptFromLog(log)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  if (failed) return <p className="notice" role="alert">The round table could not be set. Reload the page to try again.</p>;
  return script ? <Slice script={script} /> : <p className="notice" role="status">Setting the table…</p>;
}

/** If the 3D scene cannot load or start, show the plain version instead of a blank page. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Whether the viewer has asked their system for reduced motion, kept up to date if they change it. */
function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(query);
    const on = (): void => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
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
  const input = useInputKind();
  const view = useMemo(() => viewOf(state, script, input), [state, script, input]);
  const [quality, setQuality] = useState<Quality>(() => qualityFromSearch(window.location.search) ?? 'high');
  const fixed = qualityFromSearch(window.location.search) !== null;
  const frames = useRef<number[]>([]);
  const onFrame = (ms: number): void => {
    if (fixed) return;
    if (frames.current.length >= 45) return;
    frames.current.push(ms);
    if (frames.current.length === 45) setQuality(chooseQuality(frames.current.slice(5)));
  };
  const noGl = useMemo(() => new URLSearchParams(window.location.search).get('fallback') === '1' || !hasWebGl2(), []);
  const reducedMotion = usePrefersReducedMotion();
  const [lost, setLost] = useState(false);
  const onLost = useCallback(() => setLost(true), []);
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
  useEffect(() => {
    if (state.selected !== null) sound.current?.play('select');
  }, [state.selected]);
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
    <main className="slice" data-testid="slice" onPointerDown={startSound} onKeyDown={startSound} data-quality={quality} data-motion={reducedMotion ? 'reduced' : 'full'} data-figures={view.figures.filter((f) => f.present).length} data-stage={state.stage.kind} data-selected={state.selected ?? ''}>
      {lost ? (
        <SliceFallback view={view} reason="The 3D room stopped (the graphics context was lost), so this is the plain version. Reload the page to try the room again." />
      ) : noGl ? (
        <SliceFallback view={view} reason="This is the plain version of the round table. The 3D room needs WebGL." />
      ) : (
      <SceneBoundary fallback={<SliceFallback view={view} reason="The 3D room could not start, so this is the plain version." />}>
      <Suspense fallback={<p className="notice" role="status">Lighting the candles…</p>}>
        <SliceScene view={view} quality={quality} onFrame={onFrame} onHover={(seat) => dispatch({ t: 'hover', seat })} onPick={(seat) => dispatch({ t: 'pick', seat })} reducedMotion={reducedMotion} onLost={onLost} />
      </Suspense>
      </SceneBoundary>
      )}
      <SliceHud view={view} dispatch={dispatch} muted={muted} onMute={toggleMute} canSkip={stageMs(state.stage) !== null} ended={state.stage.kind === 'end'} listOpen={noGl || lost} input={input} />
      <p className={!noGl && !lost ? 'slice-caption sr-only' : 'slice-caption'} role="status" aria-live="polite">{view.announce}</p>
    </main>
  );
}
