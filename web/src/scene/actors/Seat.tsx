import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { chairPose, figurePose, platePose, yawToSeat } from '../layout.js';
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

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

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
  // Yaw of a seat as seen from this figure, relative to its own facing.
  const relYaw = (to: number): number => {
    const [tx, , tz] = figurePose(to).position;
    const dx = tx - fig.position[0];
    const dz = tz - fig.position[2];
    return wrap(Math.atan2(dx, dz) - fig.facing) * -1;
  };
  void yawToSeat;
  return (
    <>
      <group position={pose.position} rotation-y={pose.facing}>
        <group ref={chair}>
          <Chair />
        </group>
      </group>
      <group position={fig.position} rotation-y={fig.facing}>
        <Figure index={index} lookYaw={p.look === null ? null : relYaw(p.look)} speaking={p.speaking} pointYaw={p.pointAt === null ? null : relYaw(p.pointAt)} hovered={p.hovered} selected={p.selected} leaving={p.gone ? 1 : 0} />
      </group>
      <mesh position={[plateP.position[0], plateP.position[1] + 0.012, plateP.position[2]]} rotation={[-Math.PI / 2, 0, plateP.facing + Math.PI]} receiveShadow>
        <planeGeometry args={[0.42, 0.16]} />
        <meshStandardMaterial map={plate} roughness={0.7} emissive={PALETTE.amber} emissiveMap={plate} emissiveIntensity={p.hovered || p.selected ? 0.9 : 0.12} />
      </mesh>
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
