import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { chairPose, figurePose, headYaw, platePose, plateScale, plateShown, seatAngle, tablePoint, yawBetween } from '../layout.js';
import { TABLE_R } from '../models/dimensions.js';
import { Chair } from '../models/Chair.js';
import { MASKS } from '../models/masks.js';
import { PLATE_H, PLATE_W, plateTexture } from '../models/textures.js';
import { approach, useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';
import { useResource } from '../resources.js';
import type { WorldFigure } from '../world.js';
import { Figure } from './Figure.js';

export interface SeatProps {
  figure: WorldFigure;
  /** Look toward this seat (or null). */
  look: number | null;
  /** The seat the picture is seen from, which no mask turns its edge to. */
  viewer: number | null;
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
  const plateGroup = useRef<THREE.Group>(null);
  const iron = useRef<THREE.MeshStandardMaterial>(null);
  const face = useRef<THREE.MeshStandardMaterial>(null);
  const shown = useRef(1);
  const ends = useRef([new THREE.Vector3(), new THREE.Vector3()]);
  const plate = useResource(`plate:${p.figure.mask}:${p.figure.name}`, () => plateTexture(p.figure.name, MASKS[p.figure.mask]!.colour));
  const reduced = useReducedMotion();
  // A seat that can no longer be chosen gives the pointer back.
  useEffect(() => {
    if (!p.choosable) return;
    return () => void (document.body.style.cursor = '');
  }, [p.choosable]);
  const pose = chairPose(index);
  const fig = figurePose(index);
  const plateP = p.viewer === null ? { position: tablePoint(index, TABLE_R - 0.2), facing: seatAngle(index) } : platePose(index, p.viewer);
  const plateTurn = useRef<THREE.Group>(null);
  useFrame(({ camera }, dt) => {
    // Seen from no chair, each plate turns to the camera as it moves round the table, so every name can be read.
    if (p.viewer === null && plateTurn.current) plateTurn.current.rotation.y = Math.atan2(camera.position.x - plateP.position[0], camera.position.z - plateP.position[2]);
    // A plate that would be cut by the edge of the picture fades out whole, and comes back when it is whole again.
    if (plateGroup.current && iron.current && face.current) {
      const [l, r] = ends.current as [THREE.Vector3, THREE.Vector3];
      plateGroup.current.localToWorld(l.set(-PLATE_W / 2 - 0.01, 0, 0)).project(camera);
      plateGroup.current.localToWorld(r.set(PLATE_W / 2 + 0.01, 0, 0)).project(camera);
      const want = plateShown(l.x, r.x, l.z > 1 || r.z > 1);
      shown.current += (want - shown.current) * approach(dt, 8, reduced);
      const o = shown.current;
      plateGroup.current.visible = o > 0.01;
      iron.current.opacity = o;
      face.current.opacity = o;
    }
    push.current += ((p.pushedBack ? 0.55 : 0) - push.current) * approach(dt, 3, reduced);
    if (chair.current) chair.current.position.z = push.current;
  });
  // A figure the player's eye is on looks back at the player.
  const look = (p.hovered || p.selected) && p.viewer !== null ? p.viewer : p.look;
  return (
    <>
      <group position={pose.position} rotation-y={pose.facing}>
        <group ref={chair}>
          <Chair />
        </group>
      </group>
      <group position={fig.position} rotation-y={fig.facing}>
        <Figure index={index} mask={p.figure.mask} lookYaw={headYaw(index, look, p.viewer)} speaking={p.speaking} pointYaw={p.pointAt === null ? null : yawBetween(index, p.pointAt)} hovered={p.hovered} selected={p.selected} leaving={p.gone ? 1 : 0} />
      </group>
      {/* the name plate: a block of dark iron leaning back on the table, lettered on its face */}
      <group ref={plateTurn} position={plateP.position} rotation-y={plateP.facing} scale={p.viewer === null ? 1 : plateScale(index, p.viewer)}>
        <group ref={plateGroup} position={[0, PLATE_H / 2 + 0.004, 0]} rotation-x={-0.3}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[PLATE_W + 0.02, PLATE_H + 0.016, 0.03]} />
            <meshStandardMaterial ref={iron} color={PALETTE.iron} roughness={0.5} metalness={0.6} transparent />
          </mesh>
          <mesh position={[0, 0, 0.0155]}>
            <planeGeometry args={[PLATE_W, PLATE_H]} />
            <meshStandardMaterial ref={face} map={plate} roughness={0.6} transparent emissive="#ffe6c0" emissiveMap={plate} emissiveIntensity={p.selected ? 1 : p.hovered ? 0.7 : 0.16} />
          </mesh>
        </group>
      </group>
      {p.choosable ? (
        <mesh
          position={[fig.position[0], 1.0, fig.position[2]]}
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            p.onHover(index);
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
            p.onHover(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            // A swipe that ends on a figure is a look, not a choice.
            if (e.delta > 8) return;
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
