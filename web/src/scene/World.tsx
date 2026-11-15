import './three-jsx.js';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Director } from './camera/Director.js';
import { Drift } from './camera/Drift.js';
import { HeldMask } from './shell/HeldMask.js';
import { OwnPlate } from './shell/OwnPlate.js';
import { Recruit } from './moments/Recruit.js';
import { WhisperLine } from './moments/WhisperLine.js';
import { RoleSigil } from './actors/RoleSigil.js';
import { TurnCandle } from './actors/TurnCandle.js';
import { ProposalMarks } from './moments/ProposalMarks.js';
import { SpeakerLight } from './stage/SpeakerLight.js';
import { FirstPerson } from './camera/FirstPerson.js';
import { bearingTo } from './camera/fov.js';
import { BANISHED_TILT, bearingFromEye, chairPose, dawnMaskSpot, setSpacing, tablePoint } from './layout.js';
import { DAWN_MASK_SCALE, DAWN_REACH } from './models/dimensions.js';
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
import { CANDLES, type WorldView } from './worldView.js';

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
  // Where a mask found at dawn or left by the fallen lies: beside its plate as the seated eye sees it, or simply before its chair.
  const restingSpot = (seat: number): [number, number, number] => (firstPerson ? dawnMaskSpot(seat) : tablePoint(seat, DAWN_REACH));
  const dawnAt = ((): [number, number] | null => {
    if (!view.dawn) return null;
    const [cx, , cz] = chairPose(view.dawn.victim).position;
    const [tx, , tz] = restingSpot(view.dawn.victim);
    return [(cx + tx) / 2, (cz + tz) / 2];
  })();
  const maskOf = (seat: number): number => view.figures.find((f) => f.index === seat)?.mask ?? seat;
  const [litNow, setLitNow] = useState(CANDLES);
  useFrame(() => {
    if (Math.abs(lit.current - litNow) > 0.02) setLitNow(lit.current);
  });
  return (
    <ResourcesContext.Provider value={resources}>
      <color attach="background" args={['#06070b']} />
      <fogExp2 attach="fog" args={['#07080d', 0.075]} />
      <Lights mood={view.mood} litCount={litNow} quality={q} dawnAt={dawnAt} hush={!!view.whisper || !!view.recruit || (view.whisperLines ?? []).length > 0 || view.sleep === true} />
      {view.timer && view.you !== null ? <TurnCandle leftMs={view.timer.leftMs} totalMs={view.timer.totalMs} /> : null}
      {(view.proposals ?? []).length > 0 ? <ProposalMarks proposals={view.proposals!} /> : null}
      <SpeakerLight seat={view.speech?.speaker ?? view.thought?.speaker ?? null} on={view.mood === 'night'} />
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
      {!view.dawn && view.banish && (view.banish.stage === 'mask' || view.banish.stage === 'done') ? <TableMask seat={view.banish.seat} mask={maskOf(view.banish.seat)} role={view.banish.role} viewer={view.you} {...(firstPerson ? { tilt: BANISHED_TILT } : { at: tablePoint(view.banish.seat, DAWN_REACH), scale: 0.26 })} /> : null}
      {view.dawn ? <TableMask seat={view.dawn.victim} mask={maskOf(view.dawn.victim)} role={view.dawn.role} viewer={view.you} at={restingSpot(view.dawn.victim)} scale={DAWN_MASK_SCALE} /> : null}
      {(view.fallen ?? []).map((f) => (
        <TableMask key={`fallen-${maskOf(f.seat)}`} seat={f.seat} mask={maskOf(f.seat)} role={f.role} viewer={view.you} at={restingSpot(f.seat)} scale={DAWN_MASK_SCALE} settled />
      ))}
      {(view.ending ?? []).map((e) => (
        <TableMask key={`end-${maskOf(e.seat)}`} seat={e.seat} mask={maskOf(e.seat)} role={e.role} viewer={view.you} at={restingSpot(e.seat)} scale={DAWN_MASK_SCALE} />
      ))}
      {view.you !== null && view.reveal ? <HeldMask mask={maskOf(view.you)} role={view.reveal.role} partners={view.reveal.partners} /> : null}
      {view.you !== null && view.plate !== undefined && view.plate !== null ? <OwnPlate name={view.plate} mask={maskOf(view.you)} /> : null}
      {view.recruit ? <Recruit key={`${view.recruit.from}-${view.recruit.to}`} from={view.recruit.from} to={view.recruit.to} mask={maskOf(view.recruit.from)} /> : null}
      {view.figures.filter((f) => f.present && f.known).map((f) => <RoleSigil key={`role-${f.mask}`} seat={f.index} role={f.known!} />)}
      {(view.whisperLines ?? []).map((w) => <WhisperLine key={`w-${w.from}-${w.to}`} from={w.from} to={w.to} />)}
      <Speech text={view.speech && view.speech.speaker !== view.you ? view.speech.text : null} speaker={view.speech?.speaker ?? view.thought?.speaker ?? null} note={view.thought?.text ?? null} />
      {view.drift ? (
        <Drift />
      ) : view.you !== null ? (
  <FirstPerson toward={view.speaker !== null && view.speaker !== view.you ? bearingTo(view.speaker) : view.whisper && view.whisper.from !== view.you ? bearingTo(view.whisper.from) : view.dawn ? (bearingTo(view.dawn.victim) + bearingFromEye(restingSpot(view.dawn.victim))) / 2 : null} free={view.choosable.length > 0} focus={view.selected} overview={view.voting} />
      ) : (
        <Director focus={view.shot?.focus ?? view.speaker ?? view.dawn?.victim ?? null} wide={view.shot?.wide ?? view.voting} cut={view.shot?.cut ?? false} />
      )}
      {/* while a figure speaks, its own words are the caption */}
      <Caption text={view.speech ? null : (view.caption ?? view.announce)} waiting={view.choosable.length > 0} />
      <Effects quality={q} still={reduced} words={(!!view.speech && view.speech.speaker !== view.you) || !!view.thought} />
    </ResourcesContext.Provider>
  );
}
