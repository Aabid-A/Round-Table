import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { approach, useReducedMotion } from '../motion.js';
import { TABLE_Y } from '../models/dimensions.js';
import { captionTexture } from '../models/textures.js';
import { captionHold, captionOpacity, wrapCaption } from './caption.js';

/** How far in front of the eye the words hang, and how far below the level of the eye. */
const AHEAD = 1.75;
const BELOW = 0.2;

/**
 * What is happening, and whose turn it is, as words in the room: pale letters that hang in the air over the table in front of you,
 * come up, hold while they are read and fade away. No box and no page furniture. They follow your look slowly, so they are there
 * when you turn to a seat beside you. The same words go to the live region for a screen reader.
 */
export function Caption({ text }: { text: string | null }) {
  const { camera, size } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = useReducedMotion();
  const narrow = size.width / size.height < 1;
  // How wide the words may be: most of the picture's width at the distance they hang.
  const across = 2 * AHEAD * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360) * (size.width / size.height);
  const width = Math.min(1.15, across * 0.88);
  const drawn = useMemo(() => (text ? captionTexture(wrapCaption(text, narrow ? 24 : 44)) : null), [text, narrow]);
  useEffect(() => () => drawn?.texture.dispose(), [drawn]);
  const born = useRef(0);
  const fresh = useRef(true);
  useEffect(() => void (fresh.current = true), [drawn]);
  const yaw = useRef<number | null>(null);
  const look = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  useFrame(({ clock }, dt) => {
    if (!mesh.current || !material.current) return;
    if (fresh.current) {
      born.current = clock.elapsedTime;
      fresh.current = false;
    }
    const o = drawn && text ? captionOpacity(clock.elapsedTime - born.current, captionHold(text)) : 0;
    material.current.opacity = o;
    mesh.current.visible = o > 0.005;
    // Hung in front of where you are looking, and brought round after your look rather than pinned to it.
    look.setFromQuaternion(camera.quaternion);
    yaw.current = yaw.current === null ? look.y : yaw.current + (look.y - yaw.current) * approach(dt, 3, reduced);
    mesh.current.position.set(camera.position.x - Math.sin(yaw.current) * AHEAD, Math.max(TABLE_Y + 0.12, camera.position.y - BELOW - AHEAD * 0.1), camera.position.z - Math.cos(yaw.current) * AHEAD);
    mesh.current.quaternion.copy(camera.quaternion);
  });
  if (!drawn) return null;
  return (
    <mesh ref={mesh} renderOrder={10} scale={[width, width / drawn.aspect, 1]}>
      <planeGeometry args={[1, 1]} />
      {/* lit letters: they give their own light and take none, so they read the same by candle, by fire and at dawn */}
      <meshStandardMaterial ref={material} color="#000" emissive="#fff" emissiveMap={drawn.texture} alphaMap={drawn.alpha} transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
