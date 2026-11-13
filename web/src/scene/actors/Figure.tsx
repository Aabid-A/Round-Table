import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { cloakGeometry, HEAD_Y, HIP_Y, cuffBandGeometry, hoodGeometry, mantleGeometry, SHOULDER_Y, sleeveGeometry } from '../models/cloak.js';
import { handGeometry } from '../models/hand.js';
import { MaskMesh } from '../models/MaskMesh.js';
import { MASKS } from '../models/masks.js';
import { approach, idle, spring, useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';
import { useResource } from '../resources.js';

export interface FigureProps {
  index: number;
  /** Where the head turns, relative to the figure's own facing (radians, see layout.headYaw). */
  lookYaw: number;
  speaking: boolean;
  /** Pointing: the turn of the arm relative to the figure's facing, or null when the arm is inside the cloak. */
  pointYaw: number | null;
  hovered: boolean;
  selected: boolean;
  /** 0 seated at the table, 1 gone: the figure rises and walks away (eased toward). */
  leaving: number;
}

const SLEEVE = 0.46;

/**
 * A cloaked, hooded, masked figure, seated. One draped cloak with folds, a short cape for shoulders, and a deep hood around the mask.
 * Its arms stay inside the cloak; one comes out, sleeve and hand, only to point. It breathes, shifts its weight, turns its head and
 * shoulders toward whoever holds the moment, leans in when it speaks, and sits up when the player's eye is on it.
 */
export function Figure({ index, lookYaw, speaking, pointYaw, hovered, selected, leaving }: FigureProps) {
  const design = MASKS[index]!;
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const mask = useRef<THREE.MeshStandardMaterial>(null);
  const pose = useRef({ gone: 0, yaw: 0, lean: 0, point: 0, pointYaw: 0, notice: 0 });
  const out = useRef({ x: 0, v: 0 });
  const cloak = useResource(`cloak:${index}`, () => cloakGeometry(index, design.colour));
  const mantle = useResource(`mantle:${index}`, () => mantleGeometry(index, design.colour));
  const hood = useResource(`hood:${index}`, () => hoodGeometry(index));
  const sleeve = useResource('sleeve:figure', () => sleeveGeometry(SLEEVE));
  const band = useResource('cuff:figure', () => cuffBandGeometry(SLEEVE));
  const hand = useResource('hand:point', () => handGeometry('point'));
  const reduced = useReducedMotion();
  useFrame(({ clock }, dt) => {
    const k = approach(dt, 4, reduced);
    // With motion reduced a figure does not breathe or shift; it changes pose in a cut.
    const t = reduced ? 0 : clock.elapsedTime + index * 1.7;
    const p = pose.current;
    p.yaw += (lookYaw - p.yaw) * k;
    p.lean += ((speaking ? 0.13 : 0) - p.lean) * k;
    // The arm comes out on a spring, so it overshoots a little and settles instead of stopping dead.
    p.point = spring(out.current, pointYaw !== null ? 1 : 0, dt, 70, 11, reduced);
    if (pointYaw !== null) p.pointYaw += (pointYaw - p.pointYaw) * k;
    p.gone += (leaving - p.gone) * approach(dt, 1.6, reduced);
    p.notice += ((hovered || selected ? 1 : 0) - p.notice) * approach(dt, 9, reduced);
    const breath = Math.sin(t * 1.2) * idle(reduced);
    if (body.current) {
      // Leaning from the hips, with a slow shift of weight from side to side.
      body.current.rotation.x = p.lean + breath * 0.008 - p.notice * 0.03;
      body.current.rotation.z = Math.sin(t * 0.23) * 0.018;
      body.current.scale.set(1 + breath * 0.004, 1 + breath * 0.004 + p.notice * 0.012, 1 + breath * 0.008);
    }
    if (upper.current) {
      upper.current.rotation.y = p.yaw * 0.22 + p.point * p.pointYaw * 0.12;
      upper.current.position.y = breath * 0.004;
    }
    if (head.current) {
      // The shoulders may turn further to point; the head gives that back, so the mask keeps to its limit.
      head.current.rotation.y = p.yaw * 0.78 - p.point * p.pointYaw * 0.12 + Math.sin(t * 0.5) * 0.025;
      head.current.rotation.x = Math.sin(t * 0.8) * 0.015 + (speaking ? -0.04 + Math.sin(t * 5.2) * 0.012 * idle(reduced) : 0) - p.notice * 0.05;
      head.current.rotation.z = Math.sin(t * 0.31 + 1) * 0.02;
    }
    // The mask warms in its own colour while the player's eye is on it.
    if (mask.current) mask.current.emissiveIntensity = p.notice * (selected ? 0.6 : 0.25);
    if (arm.current) {
      const out = Math.max(0, p.point);
      arm.current.visible = out > 0.03;
      arm.current.rotation.set(1.25 * (1 - out) - 0.06 * out, p.pointYaw * out - upper.current!.rotation.y, 0, 'YXZ');
      arm.current.scale.setScalar(0.55 + 0.45 * Math.min(1, out));
    }
    if (root.current) {
      root.current.visible = p.gone < 0.99;
      root.current.position.set(0, p.gone * 0.05, -p.gone * 2.4);
      root.current.rotation.y = p.gone * 0.35;
    }
  });
  return (
    <group ref={root}>
      <group ref={body} position-y={HIP_Y}>
        <group position-y={-HIP_Y}>
          <mesh geometry={cloak} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.82} />
          </mesh>
          <group ref={upper}>
            <mesh geometry={mantle} castShadow receiveShadow>
              <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
            {/* the clasp that holds the cape: a small boss in the wearer's colour */}
            <mesh position={[0, 1.165, 0.168]} rotation-x={0.5} castShadow>
              <cylinderGeometry args={[0.03, 0.034, 0.014, 6]} />
              <meshStandardMaterial color={design.colour} roughness={0.35} metalness={0.6} />
            </mesh>
            <group ref={head} position={[0, HEAD_Y, 0.02]}>
              <mesh geometry={hood} castShadow receiveShadow>
                <meshStandardMaterial color={PALETTE.mantle} roughness={0.92} side={THREE.DoubleSide} />
              </mesh>
              {/* what is under the hood: only dark */}
              <mesh position={[0, 0, -0.03]} scale={[1, 1.15, 1]}>
                <sphereGeometry args={[0.16, 16, 12]} />
                <meshStandardMaterial color={PALETTE.robeDeep} roughness={1} />
              </mesh>
              <group position={[0, 0.0, 0.115]}>
                <MaskMesh index={index} scale={0.19} material={mask} />
              </group>
            </group>
            <group ref={arm} position={[-0.21, SHOULDER_Y - 0.03, 0.1]} visible={false}>
              <mesh geometry={sleeve} castShadow>
                <meshStandardMaterial color={PALETTE.robe} roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={band}>
                <meshStandardMaterial color={design.colour} roughness={0.55} metalness={0.15} emissive={design.colour} emissiveIntensity={0.15} side={THREE.DoubleSide} />
              </mesh>
              {/* the hand is modelled with its thumb toward -x; mirrored here so the thumb of this right arm lies toward the body */}
              <mesh geometry={hand} position={[0, -0.005, SLEEVE - 0.04]} scale={[-1.35, 1.35, 1.35]} castShadow>
                <meshStandardMaterial color={PALETTE.skin} roughness={0.65} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
