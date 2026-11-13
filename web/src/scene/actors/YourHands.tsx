import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { approach, idle, useReducedMotion } from '../motion.js';
import { useResource } from '../resources.js';
import * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { cuffBandGeometry, sleeveGeometry } from '../models/cloak.js';
import { TABLE_R, TABLE_Y } from '../models/dimensions.js';
import { handGeometry } from '../models/hand.js';
import { MASKS } from '../models/masks.js';
import { PALETTE } from '../palette.js';

/** A little over life size, so the fingers read at the bottom of a small screen. */
const HAND = 1.3;
const FORWARD = new THREE.Vector3(0, 0, 1);
// In the space of your own seat: the table's edge at 0, +z across the table, +x to your left.
const REST = { wrist: new THREE.Vector3(0.24, TABLE_Y + 0.036, 0.07), elbow: new THREE.Vector3(0.45, TABLE_Y - 0.04, -0.8), yaw: -0.6 };
// Raised low and out to the side, so the pointing hand is seen from beside it and not end on.
const RAISED = { wrist: new THREE.Vector3(0.34, TABLE_Y + 0.17, 0.3), elbow: new THREE.Vector3(0.5, TABLE_Y - 0.1, -0.75) };
const ROLL = new THREE.Vector3(0, 0, 1);

interface ArmProps {
  /** 1 for your left arm, -1 for your right. */
  side: 1 | -1;
  /** The seat pointed at, or null with the hand at rest on the table. Only the right arm points. */
  pointAt: number | null;
  accent: string;
}

/** One of your arms: a sleeve of your cloak from the elbow, its cuff in your mask's colour, and a hand that lies on the table or rises to point. */
function Arm({ side, pointAt, accent }: ArmProps) {
  const sleeve = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const rest = useRef<THREE.Mesh>(null);
  const point = useRef<THREE.Mesh>(null);
  const s = useRef({ up: 0, vel: 0 });
  const cloth = useResource('sleeve:yours', () => sleeveGeometry(1, 0.046));
  const band = useResource('cuff:yours', () => cuffBandGeometry(1, 0.046, 0.76));
  const lying = useResource('hand:rest', () => handGeometry('rest'));
  const pointing = useResource('hand:point', () => handGeometry('point'));
  const reduced = useReducedMotion();
  const tmp = useMemo(() => ({ wrist: new THREE.Vector3(), elbow: new THREE.Vector3(), dir: new THREE.Vector3(), aim: new THREE.Vector3(0, 0, 1), q: new THREE.Quaternion(), rest: new THREE.Quaternion(), raised: new THREE.Quaternion(), roll: new THREE.Quaternion(), e: new THREE.Euler() }), []);
  useFrame(({ clock }, dt) => {
    const p = s.current;
    const step = Math.min(dt, 0.05);
    // A spring, so the hand overshoots a little as it comes up and settles when it is set down.
    p.vel += (((pointAt !== null ? 1 : 0) - p.up) * 80 - p.vel * 12) * step;
    p.up += p.vel * step;
    if (reduced) [p.up, p.vel] = [pointAt !== null ? 1 : 0, 0];
    const up = Math.max(0, Math.min(1.1, p.up));
    const t = (clock.elapsedTime + side) * idle(reduced);
    tmp.wrist.lerpVectors(REST.wrist, RAISED.wrist, up);
    tmp.elbow.lerpVectors(REST.elbow, RAISED.elbow, up);
    tmp.wrist.x *= side;
    tmp.elbow.x *= side;
    // At rest the hands are not quite still: a breath, and a slow shift of the fingers.
    tmp.wrist.y += Math.sin(t * 1.1) * 0.0015 * (1 - up);
    if (pointAt !== null) {
      // The finger aims at the mask of the seat pointed at (in this seat's own space, which looks across the table).
      const [x, , z] = figurePose(pointAt).position;
      tmp.dir.set(-x, HEAD_Y, TABLE_R - z).sub(tmp.wrist).normalize();
      tmp.aim.lerp(tmp.dir, approach(dt, 6, reduced)).normalize();
    }
    if (hand.current) {
      tmp.rest.setFromEuler(tmp.e.set(0.07, REST.yaw * side + Math.sin(t * 0.21) * 0.03, 0, 'YXZ'));
      tmp.raised.setFromUnitVectors(FORWARD, tmp.aim).multiply(tmp.roll.setFromAxisAngle(ROLL, -side * 0.7));
      hand.current.position.copy(tmp.wrist);
      hand.current.quaternion.slerpQuaternions(tmp.rest, tmp.raised, Math.min(1, up));
    }
    if (rest.current && point.current) {
      rest.current.visible = up < 0.45;
      point.current.visible = !rest.current.visible;
    }
    if (sleeve.current) {
      tmp.dir.subVectors(tmp.wrist, tmp.elbow);
      const length = tmp.dir.length();
      sleeve.current.position.copy(tmp.elbow);
      sleeve.current.quaternion.copy(tmp.q.setFromUnitVectors(FORWARD, tmp.dir.normalize()));
      // The sleeve stops short of the wrist, so the wrist and the whole hand show.
      sleeve.current.scale.set(1, 1, length - 0.035 - 0.04 * Math.min(1, up));
    }
  });
  const skin = <meshStandardMaterial color={PALETTE.skin} roughness={0.62} />;
  return (
    <>
      <group ref={sleeve}>
        <mesh geometry={cloth} castShadow receiveShadow>
          <meshStandardMaterial color={PALETTE.robe} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* the cuff, in your own mask's colour: how you know which one is yours */}
        <mesh geometry={band} castShadow>
          <meshStandardMaterial color={accent} roughness={0.55} metalness={0.15} emissive={accent} emissiveIntensity={0.06} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* The hand is modelled as a right hand; the left is its mirror image. */}
      <group ref={hand}>
        <group scale={[side === -1 ? -HAND : HAND, HAND, HAND]}>
          <mesh ref={rest} geometry={lying} castShadow receiveShadow>
            {skin}
          </mesh>
          <mesh ref={point} geometry={pointing} castShadow visible={false}>
            {skin}
          </mesh>
        </group>
      </group>
    </>
  );
}

/**
 * Your own body in the first person: two forearms in the sleeves of your cloak and two hands resting on the table's edge, with your
 * mask's colour on the cuffs. The right hand rises to point.
 */
export function YourHands({ you, pointAt }: { you: number; pointAt: number | null }) {
  const accent = MASKS[you]!.colour;
  return (
    <group position={[0, 0, TABLE_R]} rotation-y={Math.PI}>
      <Arm side={1} pointAt={null} accent={accent} />
      <Arm side={-1} pointAt={pointAt} accent={accent} />
    </group>
  );
}
