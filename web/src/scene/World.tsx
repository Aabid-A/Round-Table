import './three-jsx.js';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Director } from './camera/Director.js';
import { Recruit } from './moments/Recruit.js';
import { FirstPerson } from './camera/FirstPerson.js';
import { bearingTo } from './camera/fov.js';
import { bearingFromEye, dawnMaskSpot, setSpacing, tablePoint } from './layout.js';
import { BANISHED_REACH, DAWN_MASK_SCALE, DAWN_REACH } from './models/dimensions.js';
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
  // A seat is where a player sits as seen from the camera's chair; the mask is who they are. The two differ once the viewer's own seat is turned to the camera.
  const firstPerson = view.you !== null;
  // A camera in a chair sits in seat 0 with room either side; a camera in no chair sees eight evenly spaced seats. Set before anything below is placed.
  setSpacing(firstPerson ? 'seated' : 'even');
  const maskOf = (seat: number): number => view.figures.find((f) => f.index === seat)?.mask ?? seat;
  const [litNow, setLitNow] = useState(CANDLES);
  useFrame(() => {
    if (Math.abs(lit.current - litNow) > 0.02) setLitNow(lit.current);
  });
  return (
    <ResourcesContext.Provider value={resources}>
      <color attach="background" args={['#06070b']} />
      <fogExp2 attach="fog" args={['#07080d', 0.075]} />
      <Lights mood={view.mood} litCount={litNow} quality={q} dawnSeat={view.dawn?.victim ?? null} hush={!!view.whisper || !!view.recruit} />
      <HoverLight hovered={view.hovered} selected={view.selected} maskOf={maskOf} />
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
            speaking={view.speaker === f.index || view.whisper?.from === f.index}
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
      {view.you !== null ? <YourHands mask={maskOf(view.you)} pointAt={view.pointing?.from === view.you ? view.pointing.at : null} /> : null}
      {view.tokens.map((t, i) => (
        <Token key={`${t.owner}-${t.target}`} owner={t.owner} target={t.target} delay={i * 0.35} mask={maskOf(t.owner)} />
      ))}
      {/* by morning last night's mask has been cleared away; the one on the table is the one the night left */}
      {!view.dawn && view.banish && (view.banish.stage === 'mask' || view.banish.stage === 'done') ? <TableMask seat={view.banish.seat} mask={maskOf(view.banish.seat)} role={view.banish.role} viewer={view.you} {...(firstPerson ? {} : { at: tablePoint(view.banish.seat, BANISHED_REACH) })} /> : null}
      {view.dawn ? <TableMask seat={view.dawn.victim} mask={maskOf(view.dawn.victim)} role={view.dawn.role} viewer={view.you} at={firstPerson ? dawnMaskSpot(view.dawn.victim) : tablePoint(view.dawn.victim, DAWN_REACH)} scale={DAWN_MASK_SCALE} /> : null}
      {(view.fallen ?? []).map((f) => (
        <TableMask key={`fallen-${f.seat}`} seat={f.seat} mask={maskOf(f.seat)} role={f.role} viewer={view.you} at={firstPerson ? dawnMaskSpot(f.seat) : tablePoint(f.seat, DAWN_REACH)} scale={DAWN_MASK_SCALE} settled />
      ))}
      {view.recruit ? <Recruit from={view.recruit.from} to={view.recruit.to} mask={maskOf(view.recruit.from)} /> : null}
      <Speech text={view.speech && view.speech.speaker !== view.you ? view.speech.text : null} speaker={view.speech?.speaker ?? null} />
      {view.you !== null ? (
  <FirstPerson toward={view.speaker !== null && view.speaker !== view.you ? bearingTo(view.speaker) : view.whisper && view.whisper.from !== view.you ? bearingTo(view.whisper.from) : view.dawn ? (bearingTo(view.dawn.victim) + bearingFromEye(dawnMaskSpot(view.dawn.victim))) / 2 : null} free={view.choosable.length > 0} focus={view.selected} overview={view.voting} />
      ) : (
        <Director focus={view.shot?.focus ?? view.speaker ?? view.dawn?.victim ?? null} wide={view.shot?.wide ?? view.voting} cut={view.shot?.cut ?? false} />
      )}
      {/* while a figure speaks, its own words are the caption */}
      <Caption text={view.speech ? null : view.announce} waiting={view.choosable.length > 0} />
      <Effects quality={q} still={reduced} />
    </ResourcesContext.Provider>
  );
}
