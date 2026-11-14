import './three-jsx.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EYE, FirstPerson } from './camera/FirstPerson.js';
import { bearingTo, bearingToTable } from './camera/fov.js';
import { Html } from '@react-three/drei';
import { figurePose } from './layout.js';
import { Seat } from './actors/Seat.js';
import { Token } from './actors/Token.js';
import { DAWN_REACH, TableMask } from './actors/TableMask.js';
import { YourHands } from './actors/YourHands.js';
import { Candle } from './models/Candle.js';
import { CANDLE_SPOTS } from './models/candles.js';
import { Fireplace } from './models/Fireplace.js';
import { Hall } from './models/Hall.js';
import { Table } from './models/Table.js';
import { Caption } from './stage/Caption.js';
import { Effects } from './stage/Effects.js';
import { HoverLight } from './stage/HoverLight.js';
import { Lights } from './stage/Lights.js';
import { QUALITY, type Quality } from './stage/quality.js';
import { ReducedMotionContext, useReducedMotion } from './motion.js';
import { ResourcesContext, SceneResources } from './resources.js';
import { CANDLES, type SliceView } from './sliceView.js';

interface Props {
  view: SliceView;
  quality: Quality;
  onHover?: (seat: number | null) => void;
  onPick?: (seat: number) => void;
  /** Called with the time each frame took, so the page can choose a level and report a frame rate. */
  onFrame?: (ms: number) => void;
  /** The viewer asked for reduced motion: cuts and fades, no idle movement. */
  reducedMotion?: boolean;
  /** The graphics context was lost (the tab was starved, the driver reset): the page should show the plain version. */
  onLost?: () => void;
}

/** Eases how many candles are lit: a candle goes out over a moment, one after another, and comes back faster. */
function useLitCount(target: number): { current: number } {
  const lit = useRef(CANDLES);
  useFrame((_, dt) => {
    const rate = target < lit.current ? 1.5 : 5;
    lit.current += Math.sign(target - lit.current) * Math.min(Math.abs(target - lit.current), rate * dt);
  });
  return lit;
}

/** Anchors the speech to the speaker's head, but never lets it leave the picture (or sit under the buttons) when the speaker is at the edge. */
function keepOnScreen(obj: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }): [number, number] {
  const v = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld).project(camera);
  const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
  const half = Math.min(135, size.width / 2 - 8);
  return [clamp((v.x * 0.5 + 0.5) * size.width, half, size.width - half), clamp((-v.y * 0.5 + 0.5) * size.height, 90, size.height - 230)];
}

function World({ view, quality, onHover, onPick }: { view: SliceView; quality: Quality; onHover: (s: number | null) => void; onPick: (s: number) => void }) {
  const q = QUALITY[quality];
  const lit = useLitCount(view.candlesLit);
  const reduced = useReducedMotion();
  // What this scene builds for the graphics card is released when the scene is taken down.
  const resources = useMemo(() => new SceneResources(), []);
  useEffect(() => () => resources.disposeAll(), [resources]);
  const [litNow, setLitNow] = useState(CANDLES);
  useFrame(() => {
    if (Math.abs(lit.current - litNow) > 0.02) setLitNow(lit.current);
  });
  return (
    <ResourcesContext.Provider value={resources}>
      <color attach="background" args={['#06070b']} />
      <fogExp2 attach="fog" args={['#07080d', 0.075]} />
      <Lights mood={view.mood} litCount={litNow} quality={q} dawnSeat={view.dawn?.victim ?? null} />
      <HoverLight hovered={view.hovered} selected={view.selected} />
      <Hall />
      <Fireplace />
      <Table />
      {CANDLE_SPOTS.map((c, i) => (
        <group key={i} position={c.position}>
          <Candle height={c.height} lit={Math.min(1, Math.max(0, litNow - i))} seed={i} />
        </group>
      ))}
      {view.figures
        .filter((f) => f.index !== view.you)
        .map((f) => (
          <Seat
            key={f.index}
            figure={f}
            look={view.looks[f.index] ?? null}
            viewer={view.you}
            speaking={view.speaker === f.index}
            pointAt={view.pointing?.from === f.index ? view.pointing.at : null}
            hovered={view.hovered === f.index}
            selected={view.selected === f.index}
            choosable={view.choosable.includes(f.index)}
            pushedBack={view.banish?.seat === f.index || view.dawn?.victim === f.index}
            gone={!f.present}
            onHover={onHover}
            onPick={onPick}
          />
        ))}
      <YourHands you={view.you} pointAt={view.pointing?.from === view.you ? view.pointing.at : null} />
      {view.tokens.map((t, i) => (
        <Token key={`${t.owner}-${t.target}`} owner={t.owner} target={t.target} delay={i * 0.35} />
      ))}
      {/* by morning last night's mask has been cleared away; the one on the table is the one the night left */}
      {!view.dawn && view.banish && (view.banish.stage === 'mask' || view.banish.stage === 'done') ? <TableMask seat={view.banish.seat} role={view.banish.role} viewer={view.you} /> : null}
      {view.dawn ? <TableMask seat={view.dawn.victim} role={view.dawn.role} viewer={view.you} reach={DAWN_REACH} /> : null}
      {view.speech && view.speech.speaker !== view.you ? (
        <Html position={[figurePose(view.speech.speaker).position[0], 1.86, figurePose(view.speech.speaker).position[2]]} center zIndexRange={[10, 0]} calculatePosition={keepOnScreen} style={{ pointerEvents: 'none' }}>
          <p className="slice-speech" data-testid="speech">{view.speech.text}</p>
        </Html>
      ) : null}
      <FirstPerson toward={view.speaker !== null && view.speaker !== view.you ? bearingTo(view.speaker) : view.dawn ? (bearingTo(view.dawn.victim) + bearingToTable(view.dawn.victim, DAWN_REACH)) / 2 : null} free={view.choosable.length > 0} focus={view.selected} overview={view.tokens.length > 0 && view.banish === null && view.mood === 'day'} />
      {/* while a figure speaks, its own words are the caption */}
      <Caption text={view.speech ? null : view.announce} />
      <Effects quality={q} still={reduced} />
    </ResourcesContext.Provider>
  );
}

/** The slice's WebGL scene. It draws the view it is given and nothing else; the page owns the game. */
export default function SliceScene({ view, quality, onFrame, onHover = () => {}, onPick = () => {}, reducedMotion = false, onLost }: Props) {
  const q = QUALITY[quality];
  return (
    <Canvas
      key={quality}
      shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      camera={{ fov: 58, near: 0.05, far: 40, position: EYE }}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#06070b')}
    >
      <Meter onFrame={onFrame} />
      <ContextWatch onLost={onLost} />
      <ReducedMotionContext.Provider value={reducedMotion}>
        <World view={view} quality={quality} onHover={onHover} onPick={onPick} />
      </ReducedMotionContext.Provider>
    </Canvas>
  );
}

/**
 * Reports each frame's time to the page, and leaves what the last whole frame cost (draw calls and triangles, every pass counted)
 * on the canvas as data- attributes: the debug hook a test or a person reads.
 */
function Meter({ onFrame }: { onFrame: ((ms: number) => void) | undefined }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => void (gl.info.autoReset = true);
  }, [gl]);
  // Runs before anything is drawn: read what the frame before this one cost, then start counting again.
  useFrame((_, dt) => {
    onFrame?.(dt * 1000);
    if (n.current++ % 10 === 1) {
      gl.domElement.dataset.calls = String(gl.info.render.calls);
      gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    }
    gl.info.reset();
  }, -1);
  return null;
}

/** Tells the page when the graphics context is lost, so it can fall back instead of showing a frozen picture. */
function ContextWatch({ onLost }: { onLost: (() => void) | undefined }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!onLost) return;
    const el = gl.domElement;
    const lost = (e: Event): void => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', lost);
    // Removed before the canvas is taken down, so the scene's own shutdown is never mistaken for a loss.
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}
