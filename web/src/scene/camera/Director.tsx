import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { approach, useReducedMotion } from '../motion.js';
import { shotFor } from './shots.js';

interface Props {
  focus: number | null;
  wide: boolean;
  /** Jump to the new shot instead of gliding (a director's cut, on an event). */
  cut: boolean;
}

/**
 * The camera for a room seen from no chair: a director. It holds a shot of whoever has the moment and pushes in slowly, pulls back
 * wide for votes and reveals, glides between shots and cuts on events. With motion reduced every change of shot is a cut and nothing
 * drifts. It never floats free: there is no orbit.
 */
export function Director({ focus, wide, cut }: Props) {
  const { camera, gl, size } = useThree();
  const reduced = useReducedMotion();
  const shot = useMemo(() => shotFor(focus, wide), [focus, wide]);
  // The debug hook a test reads: which shot is held.
  const shotName = focus === null || wide ? 'wide' : String(focus);
  const pos = useRef(new THREE.Vector3(...shot.position));
  const look = useRef(new THREE.Vector3(...shot.target));
  const held = useRef(0);
  const jump = useRef(true);
  useEffect(() => {
    held.current = 0;
    if (cut || reduced) jump.current = true;
  }, [shot, cut, reduced]);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    // A tall window needs a wider lens to keep the table in the picture.
    cam.fov = size.width / size.height < 1 ? 62 : 42;
    cam.updateProjectionMatrix();
  }, [camera, size]);
  const want = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    held.current += dt;
    target.set(...shot.target);
    // The push-in: a part of the way toward the target over about twelve seconds, then still.
    const push = reduced ? 0 : shot.push * Math.min(1, held.current / 12);
    want.set(...shot.position).lerp(target, push);
    const k = jump.current ? 1 : approach(dt, 1.6, false);
    jump.current = false;
    pos.current.lerp(want, k);
    look.current.lerp(target, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    if (gl.domElement.dataset.shot !== shotName) gl.domElement.dataset.shot = shotName;
  });
  return null;
}
