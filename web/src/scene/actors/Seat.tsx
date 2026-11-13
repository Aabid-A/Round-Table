import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { chairPose, figurePose, headYaw, platePose, yawBetween } from '../layout.js';
import { Chair } from '../models/Chair.js';
import { MASKS } from '../models/masks.js';
import { plateTexture } from '../models/textures.js';
import { PALETTE } from '../palette.js';
import type { SliceFigure } from '../sliceView.js';
import { Figure } from './Figure.js';

export interface SeatProps {
  figure: SliceFigure;
  /** Look toward this seat (or null). */
  look: number | null;
  /** The seat the picture is seen from, which no mask turns its edge to. */
  viewer: number;
  speaking: boolean;
  /** The seat this figure points at, or null. */
  pointAt: number | null;
  hovered: boolean;
  selected: boolean;
  choosable: boolean;
  /** The chair is pushed back (the banished, the dead). */
  pushedBack: boolean;
  gone: boolean;
  onHover: (seat: number | null) => void;
  onPick: (seat: number) => void;
}

/** One place at the table: a chair, a figure, a name plate, and a hit area when the player may choose it. */
export function Seat(p: SeatProps) {
  const { index } = p.figure;
  const chair = useRef<THREE.Group>(null);
  const push = useRef(0);
  const plate = useMemo(() => plateTexture(p.figure.name, MASKS[index]!.colour), [p.figure.name, index]);
  const pose = chairPose(index);
  const fig = figurePose(index);
  const plateP = platePose(index);
  useFrame((_, dt) => {
    push.current += ((p.pushedBack ? 0.55 : 0) - push.current) * (1 - Math.exp(-dt * 3));
    if (chair.current) chair.current.position.z = push.current;
  });
  // A figure the player's eye is on looks back at the player.
  const look = p.hovered || p.selected ? p.viewer : p.look;
  return (
    <>
      <group position={pose.position} rotation-y={pose.facing}>
        <group ref={chair}>
          <Chair />
        </group>
      </group>
      <group position={fig.position} rotation-y={fig.facing}>
        <Figure index={index} lookYaw={headYaw(index, look, p.viewer)} speaking={p.speaking} pointYaw={p.pointAt === null ? null : yawBetween(index, p.pointAt)} hovered={p.hovered} selected={p.selected} leaving={p.gone ? 1 : 0} />
      </group>
      <group position={[plateP.position[0], plateP.position[1], plateP.position[2]]} rotation-y={plateP.facing}>
        <mesh position={[0, 0.1, 0]} rotation-x={-0.55} receiveShadow castShadow>
          <planeGeometry args={[0.46, 0.17]} />
          <meshStandardMaterial map={plate} roughness={0.7} side={THREE.DoubleSide} emissive={PALETTE.amber} emissiveMap={plate} emissiveIntensity={p.hovered || p.selected ? 0.9 : 0.35} />
        </mesh>
      </group>
      {p.choosable ? (
        <mesh
          position={[fig.position[0], 1.0, fig.position[2]]}
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            p.onHover(index);
          }}
          onPointerOut={() => p.onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            p.onPick(index);
          }}
        >
          <cylinderGeometry args={[0.42, 0.42, 1.5, 10]} />
          <meshBasicMaterial />
        </mesh>
      ) : null}
    </>
  );
}
