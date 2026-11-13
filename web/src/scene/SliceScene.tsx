import './three-jsx.js';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { FirstPerson } from './camera/FirstPerson.js';
import { chairPose } from './layout.js';
import { Candle } from './models/Candle.js';
import { CANDLE_SPOTS } from './models/candles.js';
import { Chair } from './models/Chair.js';
import { Fireplace } from './models/Fireplace.js';
import { Hall } from './models/Hall.js';
import { Table } from './models/Table.js';
import { Effects } from './stage/Effects.js';
import { Lights } from './stage/Lights.js';
import { QUALITY, type Quality } from './stage/quality.js';
import { CANDLES, type SliceView } from './sliceView.js';

interface Props {
  view: SliceView;
  quality: Quality;
  /** Called with the time each frame took, so the page can choose a level and report a frame rate. */
  onFrame?: (ms: number) => void;
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

function World({ view, quality }: { view: SliceView; quality: Quality }) {
  const q = QUALITY[quality];
  const lit = useLitCount(view.candlesLit);
  const [litNow, setLitNow] = useState(CANDLES);
  useFrame(() => {
    if (Math.abs(lit.current - litNow) > 0.02) setLitNow(lit.current);
  });
  return (
    <>
      <color attach="background" args={['#06070b']} />
      <fogExp2 attach="fog" args={['#07080d', 0.075]} />
      <Lights mood={view.mood} litCount={litNow} quality={q} />
      <Hall />
      <Fireplace />
      <Table />
      {CANDLE_SPOTS.map((c, i) => (
        <group key={i} position={c.position}>
          <Candle height={c.height} lit={Math.min(1, Math.max(0, litNow - i))} seed={i} />
        </group>
      ))}
      {view.figures.map((f) => {
        const p = chairPose(f.index);
        return (
          <group key={f.index} position={p.position} rotation-y={p.facing}>
            <Chair />
          </group>
        );
      })}
      <FirstPerson toward={null} free />
      <Effects quality={q} />
    </>
  );
}

/** The slice's WebGL scene. It draws the view it is given and nothing else; the page owns the game. */
export default function SliceScene({ view, quality, onFrame }: Props) {
  const q = QUALITY[quality];
  return (
    <Canvas
      key={quality}
      shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      camera={{ fov: 54, near: 0.05, far: 40, position: [0, 1.2, 2.5] }}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#06070b')}
    >
      <Meter onFrame={onFrame} />
      <World view={view} quality={quality} />
    </Canvas>
  );
}

function Meter({ onFrame }: { onFrame: ((ms: number) => void) | undefined }) {
  useFrame((_, dt) => onFrame?.(dt * 1000));
  return null;
}
