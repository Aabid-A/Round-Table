import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import { MaskMesh } from '../models/MaskMesh.js';
import { MASKS } from '../models/masks.js';
import { PALETTE } from '../palette.js';

export interface FigureProps {
  index: number;
  /** Head yaw relative to the figure's own facing (radians, positive to its left), or null to look at the table. */
  lookYaw: number | null;
  speaking: boolean;
  /** Pointing: yaw of the arm relative to the figure's facing. */
  pointYaw: number | null;
  hovered: boolean;
  selected: boolean;
  /** 0 seated at the table, 1 gone: the figure rises and walks away (eased toward). */
  leaving: number;
}

const robe = new THREE.Color(PALETTE.robe);

/**
 * A hooded, masked figure, seated. Real geometry: a robe, shoulders, a hood, a mask in its own shape, two forearms and hands on the table.
 * It breathes, turns its head toward whoever holds the moment, leans in a little when it speaks and raises an arm to point.
 */
export function Figure({ index, lookYaw, speaking, pointYaw, hovered, selected, leaving }: FigureProps) {
  const design = MASKS[index]!;
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const pose = useRef({ gone: 0, yaw: 0, lean: 0, point: 0, pointYaw: 0, glow: 0 });
  const body = useMemo(
    () => new THREE.LatheGeometry([[0.0, 0.0], [0.3, 0.02], [0.36, 0.25], [0.3, 0.55], [0.22, 0.72], [0.0, 0.76]].map(([x, y]) => new THREE.Vector2(x, y)), 16),
    [],
  );
  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 4);
    const t = clock.elapsedTime + index * 1.7;
    const p = pose.current;
    p.yaw += ((lookYaw ?? 0) - p.yaw) * k;
    p.lean += ((speaking ? 0.2 : 0) - p.lean) * k;
    p.point += ((pointYaw !== null ? 1 : 0) - p.point) * k;
    if (pointYaw !== null) p.pointYaw += (pointYaw - p.pointYaw) * k;
    p.gone += (leaving - p.gone) * (1 - Math.exp(-dt * 1.6));
    p.glow += ((hovered || selected ? 1 : 0) - p.glow) * k;
    if (torso.current) {
      torso.current.rotation.x = p.lean + Math.sin(t * 1.2) * 0.012;
      torso.current.position.y = 0.46 + Math.sin(t * 1.2) * 0.004;
    }
    if (head.current) {
      head.current.rotation.y = Math.max(-1.3, Math.min(1.3, p.yaw)) + Math.sin(t * 0.5) * 0.02;
      head.current.rotation.x = Math.sin(t * 0.8) * 0.015 + (speaking ? -0.05 : 0);
    }
    if (arm.current) {
      arm.current.rotation.x = -1.2 * p.point;
      arm.current.rotation.y = p.pointYaw * p.point;
    }
    if (root.current) {
      root.current.visible = p.gone < 0.99;
      root.current.position.set(0, p.gone * 0.05, -p.gone * 2.4);
      root.current.rotation.y = p.gone * 0.35;
    }
  });
  const hand = (side: 1 | -1): ReactElement => (
    <group position={[side * 0.2, 0.34, 0.36]}>
      <mesh rotation-x={Math.PI / 2 - 0.15} position={[0, 0, 0.0]} castShadow>
        <capsuleGeometry args={[0.045, 0.34, 4, 8]} />
        <meshStandardMaterial color={PALETTE.robe} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.03, 0.3]} castShadow>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
      </mesh>
    </group>
  );
  return (
    <group ref={root}>
      <group ref={torso} position-y={0.46}>
        <mesh geometry={body} castShadow receiveShadow>
          <meshStandardMaterial color={robe} roughness={0.95} />
        </mesh>
        {/* shoulders */}
        <mesh position={[0, 0.7, 0]} rotation-z={Math.PI / 2} castShadow>
          <capsuleGeometry args={[0.1, 0.34, 4, 10]} />
          <meshStandardMaterial color={robe} roughness={0.95} />
        </mesh>
        {/* the sash: the figure's own colour, a second cue after the mask */}
        <mesh position={[0, 0.5, 0.2]} rotation-x={-0.25}>
          <boxGeometry args={[0.1, 0.5, 0.02]} />
          <meshStandardMaterial color={design.colour} roughness={0.6} emissive={design.colour} emissiveIntensity={0.06} />
        </mesh>
        <group ref={head} position={[0, 0.88, 0.02]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 18, 14]} />
            <meshStandardMaterial color={PALETTE.robeDeep} roughness={1} />
          </mesh>
          {/* the hood: a cone over the head, open at the front */}
          <mesh position={[0, 0.1, -0.05]} rotation-x={-0.12} castShadow>
            <coneGeometry args={[0.27, 0.46, 18, 1, true]} />
            <meshStandardMaterial color={robe} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          <group position={[0, 0.0, 0.19]}>
            <MaskMesh index={index} scale={0.19} />
          </group>
          <pointLight position={[0, 0, 0.4]} color={design.colour} intensity={0.5 * pose.current.glow} distance={1.4} />
        </group>
        {hand(1)}
        {hand(-1)}
        {/* the pointing arm replaces the right hand when it is raised */}
        <group ref={arm} position={[0.22, 0.68, 0.06]}>
          <mesh position={[0, 0, 0.26]} rotation-x={Math.PI / 2} castShadow visible={pointYaw !== null}>
            <capsuleGeometry args={[0.04, 0.4, 4, 8]} />
            <meshStandardMaterial color={robe} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.55]} visible={pointYaw !== null}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
