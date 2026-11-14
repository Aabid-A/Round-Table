import './three-jsx.js';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FirstPerson } from './camera/FirstPerson.js';
import { bearingTo } from './camera/fov.js';
import { BANISHED_TILT, bearingFromEye, dawnMaskSpot } from './layout.js';
import { DAWN_MASK_SCALE } from './models/dimensions.js';
import { Seat } from './actors/Seat.js';
import { Token } from './actors/Token.js';
import { TableMask } from './actors/TableMask.js';
import { YourHands } from './actors/YourHands.js';
import { Candle } from './models/Candle.js';
import { CANDLE_SPOTS } from './models/candles.js';
import { Fireplace } from './models/Fireplace.js';
import { Hall } from './models/Hall.js';
import { Table } from './models/Table.js';
import { Caption } from './stage/Caption.js';
import { Speech } from './stage/Speech.js';
import { Effects } from './stage/Effects.js';
import { HoverLight } from './stage/HoverLight.js';
import { Lights } from './stage/Lights.js';
import { QUALITY, type Quality } from './stage/quality.js';
import { useReducedMotion } from './motion.js';
import { ResourcesContext, SceneResources } from './resources.js';
import { CANDLES, type WorldView } from './world.js';

/** Eases how many candles are lit: a candle goes out over a moment, one after another, and comes back faster. */
function useLitCount(target: number): { current: number } {
  const lit = useRef(CANDLES);
  useFrame((_, dt) => {
    const rate = target < lit.current ? 1.5 : 5;
    lit.current += Math.sign(target - lit.current) * Math.min(Math.abs(target - lit.current), rate * dt);
  });
  return lit;
}

/**
 * The room: the hall, the table and candles, the figures in their seats, your hands, tokens, masks on the table, speech and the turn
 * prompt, lit and filmed. It draws the view it is given and nothing else. It goes inside a SceneCanvas.
 */
export function World({ view, quality, onHover, onPick }: { view: WorldView; quality: Quality; onHover: (s: number | null) => void; onPick: (s: number) => void }) {
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
      {!view.dawn && view.banish && (view.banish.stage === 'mask' || view.banish.stage === 'done') ? <TableMask seat={view.banish.seat} role={view.banish.role} viewer={view.you} tilt={BANISHED_TILT} /> : null}
      {view.dawn ? <TableMask seat={view.dawn.victim} role={view.dawn.role} viewer={view.you} at={dawnMaskSpot(view.dawn.victim)} scale={DAWN_MASK_SCALE} /> : null}
      <Speech text={view.speech && view.speech.speaker !== view.you ? view.speech.text : null} speaker={view.speech?.speaker ?? null} />
      <FirstPerson toward={view.speaker !== null && view.speaker !== view.you ? bearingTo(view.speaker) : view.dawn ? (bearingTo(view.dawn.victim) + bearingFromEye(dawnMaskSpot(view.dawn.victim))) / 2 : null} free={view.choosable.length > 0} focus={view.selected} overview={view.voting} />
      {/* while a figure speaks, its own words are the caption */}
      <Caption text={view.speech ? null : view.announce} waiting={view.choosable.length > 0} />
      <Effects quality={q} still={reduced} />
    </ResourcesContext.Provider>
  );
}
