import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { chairPose, tablePoint } from '../layout.js';
import { CLUSTER_LIGHTS } from '../models/candles.js';
import type { SliceMood } from '../sliceView.js';
import type { QualitySettings } from './quality.js';

interface Props {
  mood: SliceMood;
  /** How many of the six candles are lit, as a number that moves smoothly (a candle going out is half lit for a moment). */
  litCount: number;
  quality: QualitySettings;
  /** The seat the morning light falls on (the one found empty at dawn), or null. */
  dawnSeat: number | null;
}

/** Where the morning comes in: a high window behind the player's left shoulder. */
const WINDOW: [number, number, number] = [-4.5, 6, 6.5];
/** How bright the fire is by mood. With the candles out the eye opens to it, so its glow carries across the table. */
const FIRE = { day: 62, night: 190, dawn: 90 } as const;
/** The faint cold light from above. At night it is what lets the masks and the empty chair be made out; it never lights the room. */
const FILL = { day: 0.2, night: 1.5, dawn: 1.3 } as const;

/**
 * The light is designed, not ambient: a warm point light over each pair of candles with flicker, a bigger orange one in the fireplace,
 * a faint cold fill so the dark is blue not black, and at dawn one shaft of pale gold from a high window that finds the empty chair
 * and the mask on the table in front of it. The only ambient light is under 0.15.
 */
export function Lights({ mood, litCount, quality, dawnSeat }: Props) {
  const clusters = useRef<(THREE.PointLight | null)[]>([]);
  const fire = useRef<THREE.PointLight>(null);
  const shaft = useRef<THREE.SpotLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const level = useRef({ fire: FIRE.day as number });
  // The shaft is aimed between the empty chair and the mask left on the table.
  const aim = useMemo(() => {
    const o = new THREE.Object3D();
    if (dawnSeat !== null) {
      const [cx, , cz] = chairPose(dawnSeat).position;
      const [tx, , tz] = tablePoint(dawnSeat, 0.7);
      o.position.set((cx + tx) / 2, 0.9, (cz + tz) / 2);
    }
    return o;
  }, [dawnSeat]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 1.4);
    clusters.current.forEach((l, c) => {
      if (!l) return;
      // The two candles of a cluster: how lit the pair is.
      const lit = Math.min(1, Math.max(0, litCount - c * 2) / 2) * 0.5 + Math.min(1, Math.max(0, litCount - c * 2 - 1)) * 0.5;
      l.intensity = lit * (3.4 + Math.sin(t * 9 + c * 3) * 0.5 + Math.sin(t * 23 + c) * 0.3);
    });
    level.current.fire += (FIRE[mood] - level.current.fire) * k;
    if (fire.current) fire.current.intensity = level.current.fire * (1 + Math.sin(t * 6.1) * 0.11 + Math.sin(t * 17) * 0.06);
    if (shaft.current) shaft.current.intensity += ((mood === 'dawn' && dawnSeat !== null ? 420 : 0) - shaft.current.intensity) * k;
    if (fill.current) fill.current.intensity += (FILL[mood] - fill.current.intensity) * k;
  });
  const shadowSize = quality.shadowMapSize;
  return (
    <>
      <hemisphereLight args={['#2a3050', '#0c0b10', 0.12]} />
      <directionalLight ref={fill} position={[2, 7, 6]} color={PALETTE.coolFill} intensity={FILL.day} />
      <primitive object={aim} />
      <spotLight ref={shaft} position={WINDOW} target={aim} color="#ffe2b0" intensity={0} angle={0.125} penumbra={0.8} distance={22} decay={1.6} castShadow={quality.shadows} shadow-mapSize={[shadowSize, shadowSize]} shadow-bias={-0.0006} />
      {CLUSTER_LIGHTS.map((p, c) => (
        <pointLight
          key={c}
          ref={(l) => void (clusters.current[c] = l)}
          position={p}
          color={PALETTE.amber}
          distance={9}
          decay={2}
          castShadow={quality.shadows && c === 0}
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-bias={-0.0008}
          shadow-radius={5}
        />
      ))}
      <pointLight ref={fire} position={[0, 1.4, -6.6]} color="#ff8a3c" distance={20} decay={1.7} castShadow={quality.shadows} shadow-mapSize={[shadowSize, shadowSize]} shadow-bias={-0.001} />
    </>
  );
}
