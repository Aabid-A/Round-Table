import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TABLE_Y } from '../models/dimensions.js';
import { idle, useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';

/** How tall the turn candle stands with all of the turn's time left, in metres. */
const TALL = 0.24;

/**
 * Your turn's time, on the table before you (see /game-feel: time is shown in the room first): a short candle by your right hand that
 * burns down as the time runs out. Its flame quickens and reddens in the last quarter. It eases between the page's ticks.
 */
export function TurnCandle({ leftMs, totalMs }: { leftMs: number; totalMs: number }) {
  const wax = useRef<THREE.Mesh>(null);
  const flame = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const shown = useRef(1);
  const reduced = useReducedMotion();
  const gl = useThree((s) => s.gl);
  const colours = useMemo(() => ({ calm: new THREE.Color(PALETTE.flame), late: new THREE.Color('#ff6a3a') }), []);
  const tenth = useRef(-1);
  useEffect(() => () => void delete gl.domElement.dataset.timer, [gl]);
  useFrame(({ clock }, dt) => {
    const want = totalMs > 0 ? Math.max(0, Math.min(1, leftMs / totalMs)) : 0;
    shown.current += (want - shown.current) * (1 - Math.exp(-dt * 4));
    const h = 0.02 + TALL * shown.current;
    if (wax.current) {
      wax.current.scale.y = h;
      wax.current.position.y = TABLE_Y + h / 2;
    }
    const late = shown.current < 0.25;
    const f = 1 + Math.sin(clock.elapsedTime * (late ? 24 : 9)) * 0.12 * idle(reduced);
    if (flame.current) {
      flame.current.position.y = TABLE_Y + h + 0.03;
      flame.current.scale.set(1, f, 1);
      (flame.current.material as THREE.MeshStandardMaterial).emissive.copy(late ? colours.late : colours.calm);
    }
    if (glow.current) {
      glow.current.position.y = TABLE_Y + h + 0.08;
      glow.current.intensity = (late ? 0.9 : 0.6) * f;
    }
    // The debug hook a test reads: how much of the turn is left, in tenths.
    const t = Math.round(want * 10);
    if (t !== tenth.current) {
      tenth.current = t;
      gl.domElement.dataset.timer = String(t);
    }
  });
  return (
    <group position={[0.36, 0, 1.12]}>
      <mesh ref={wax} castShadow>
        <cylinderGeometry args={[0.022, 0.024, 1, 14]} />
        <meshStandardMaterial color={PALETTE.wax} roughness={0.6} />
      </mesh>
      <mesh ref={flame}>
        <sphereGeometry args={[0.012, 10, 8]} />
        <meshStandardMaterial color="#000" emissive={PALETTE.flame} emissiveIntensity={3} />
      </mesh>
      <pointLight ref={glow} color={PALETTE.amber} intensity={0.6} distance={1.2} decay={2} />
    </group>
  );
}
