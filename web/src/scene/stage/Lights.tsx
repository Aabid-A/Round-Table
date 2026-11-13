import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { CLUSTER_LIGHTS } from '../models/candles.js';
import type { SliceMood } from '../sliceView.js';
import type { QualitySettings } from './quality.js';

interface Props {
  mood: SliceMood;
  /** How many of the six candles are lit, as a number that moves smoothly (a candle going out is half lit for a moment). */
  litCount: number;
  quality: QualitySettings;
}

/**
 * The light is designed, not ambient: a warm point light over each pair of candles with flicker, a bigger orange one in the fireplace,
 * a faint cold fill so the dark is blue not black, and a thin cold-gold beam at dawn. The only ambient light is under 0.15.
 */
export function Lights({ mood, litCount, quality }: Props) {
  const clusters = useRef<(THREE.PointLight | null)[]>([]);
  const fire = useRef<THREE.PointLight>(null);
  const dawn = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    clusters.current.forEach((l, c) => {
      if (!l) return;
      // The two candles of a cluster: how lit the pair is.
      const lit = Math.min(1, Math.max(0, litCount - c * 2) / 2) * 0.5 + Math.min(1, Math.max(0, litCount - c * 2 - 1)) * 0.5;
      l.intensity = lit * (3.4 + Math.sin(t * 9 + c * 3) * 0.5 + Math.sin(t * 23 + c) * 0.3);
    });
    if (fire.current) fire.current.intensity = 62 + Math.sin(t * 6.1) * 7 + Math.sin(t * 17) * 4;
    if (dawn.current) dawn.current.intensity += ((mood === 'dawn' ? 2.4 : 0) - dawn.current.intensity) * 0.04;
    if (fill.current) fill.current.intensity += ((mood === 'night' ? 0.12 : mood === 'dawn' ? 0.5 : 0.2) - fill.current.intensity) * 0.04;
  });
  const shadowSize = quality.shadowMapSize;
  return (
    <>
      <hemisphereLight args={['#2a3050', '#0c0b10', 0.12]} />
      <directionalLight ref={fill} position={[3, 6, 5]} color={PALETTE.coolFill} intensity={0.2} />
      <directionalLight ref={dawn} position={[-4, 5, 6]} color="#ffd9a0" intensity={0} castShadow={quality.shadows} shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={1} shadow-camera-far={16} shadow-bias={-0.0004} />
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
