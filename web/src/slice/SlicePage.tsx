import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { runGame } from '../../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../../src/players/mock.js';
import { buildPrompt } from '../../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../../src/prompts/system.js';
import { useInputKind } from '../scene/input.js';
import { hasWebGl2, SceneBoundary, usePrefersReducedMotion, useQualityProbe, useRoomSound } from '../scene/host.js';
import { cueForStage } from './cues.js';
import { paceFromSearch } from './params.js';
import { initial, reduce, stageMs, viewOf } from './machine.js';
import { SliceFallback } from './SliceFallback.js';
import { SliceHud } from './SliceHud.js';
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

function Slice({ script }: { script: SliceScript }) {
  const [state, dispatch] = useReducer((s: ReturnType<typeof initial>, a: Parameters<typeof reduce>[1]) => reduce(s, a, script), undefined, initial);
  const input = useInputKind();
  const view = useMemo(() => viewOf(state, script, input), [state, script, input]);
  const { quality, onFrame } = useQualityProbe(window.location.search);
  const noGl = useMemo(() => new URLSearchParams(window.location.search).get('fallback') === '1' || !hasWebGl2(), []);
  const reducedMotion = usePrefersReducedMotion();
  const [lost, setLost] = useState(false);
  const onLost = useCallback(() => setLost(true), []);
  const pace = useMemo(() => paceFromSearch(window.location.search), []);
  const { muted, start: startSound, toggleMute, play } = useRoomSound();
  useEffect(() => {
    const cue = cueForStage(state.stage);
    if (cue) play(cue);
  }, [state.stage, play]);
  useEffect(() => {
    if (state.selected !== null) play('select');
  }, [state.selected, play]);
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
