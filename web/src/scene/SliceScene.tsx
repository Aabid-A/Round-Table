import './three-jsx.js';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { FirstPerson } from './camera/FirstPerson.js';
import { Html } from '@react-three/drei';
import { figurePose, yawToSeat } from './layout.js';
import { Seat } from './actors/Seat.js';
import { Token } from './actors/Token.js';
import { TableMask } from './actors/TableMask.js';
import { YourHands } from './actors/YourHands.js';
import { Candle } from './models/Candle.js';
import { CANDLE_SPOTS } from './models/candles.js';
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
  onHover?: (seat: number | null) => void;
  onPick?: (seat: number) => void;
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

function World({ view, quality, onHover, onPick }: { view: SliceView; quality: Quality; onHover: (s: number | null) => void; onPick: (s: number) => void }) {
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
      {view.figures
        .filter((f) => f.index !== view.you)
        .map((f) => (
          <Seat
            key={f.index}
            figure={f}
            look={view.looks[f.index] ?? null}
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
      <YourHands pointAt={view.pointing?.from === view.you ? view.pointing.at : null} />
      {view.tokens.map((t, i) => (
        <Token key={`${t.owner}-${t.target}`} owner={t.owner} target={t.target} delay={i * 0.35} />
      ))}
      {view.banish && (view.banish.stage === 'mask' || view.banish.stage === 'done') ? <TableMask seat={view.banish.seat} role={view.banish.role} /> : null}
      {view.dawn ? <TableMask seat={view.dawn.victim} role={view.dawn.role} /> : null}
      {view.speech && view.speech.speaker !== view.you ? (
        <Html position={[figurePose(view.speech.speaker).position[0], 1.75, figurePose(view.speech.speaker).position[2]]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <p className="slice-speech" data-testid="speech">{view.speech.text}</p>
        </Html>
      ) : null}
      <FirstPerson toward={view.speaker !== null && view.speaker !== view.you ? yawToSeat(view.speaker) : null} free={view.choosable.length > 0} />
      <Effects quality={q} />
    </>
  );
}

/** The slice's WebGL scene. It draws the view it is given and nothing else; the page owns the game. */
export default function SliceScene({ view, quality, onFrame, onHover = () => {}, onPick = () => {} }: Props) {
  const q = QUALITY[quality];
  return (
    <Canvas
      key={quality}
      shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      camera={{ fov: 58, near: 0.05, far: 40, position: [0, 1.22, 2.62] }}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#06070b')}
    >
      <Meter onFrame={onFrame} />
      <World view={view} quality={quality} onHover={onHover} onPick={onPick} />
    </Canvas>
  );
}

function Meter({ onFrame }: { onFrame: ((ms: number) => void) | undefined }) {
  useFrame((_, dt) => onFrame?.(dt * 1000));
  return null;
}
