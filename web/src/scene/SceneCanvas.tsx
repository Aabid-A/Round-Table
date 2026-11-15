import './three-jsx.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { EYE } from './camera/FirstPerson.js';
import { ReducedMotionContext } from './motion.js';
import { QUALITY, type Quality } from './stage/quality.js';

interface Props {
  quality: Quality;
  /** Called with the time each frame took, so the page can choose a level and report a frame rate. */
  onFrame?: ((ms: number) => void) | undefined;
  /** The viewer asked for reduced motion: cuts and fades, no idle movement. */
  reducedMotion?: boolean;
  /** The graphics context was lost (the tab was starved, the driver reset): the page should show the plain version. */
  onLost?: (() => void) | undefined;
  children: ReactNode;
}

/**
 * The WebGL canvas every mode draws the room in: shadows, resolution and antialiasing by quality level, a frame meter, a watch for a
 * lost context, and the reduced-motion setting for everything inside. What is drawn is up to the children.
 */
export function SceneCanvas({ quality, onFrame, reducedMotion = false, onLost, children }: Props) {
  const q = QUALITY[quality];
  return (
    <Canvas
      key={quality}
      shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={q.dpr}
      camera={{ fov: 58, near: 0.05, far: 40, position: EYE }}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#06070b')}
    >
      <Meter onFrame={onFrame} />
      <ContextWatch onLost={onLost} />
      <ReducedMotionContext.Provider value={reducedMotion}>{children}</ReducedMotionContext.Provider>
    </Canvas>
  );
}

/**
 * Reports each frame's time to the page, and leaves what the last whole frame cost (draw calls and triangles, every pass counted)
 * on the canvas as data- attributes: the debug hook a test or a person reads.
 */
function Meter({ onFrame }: { onFrame: ((ms: number) => void) | undefined }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => void (gl.info.autoReset = true);
  }, [gl]);
  // Runs before anything is drawn: read what the frame before this one cost, then start counting again.
  useFrame((_, dt) => {
    onFrame?.(dt * 1000);
    if (n.current++ % 10 === 1) {
      gl.domElement.dataset.calls = String(gl.info.render.calls);
      gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    }
    gl.info.reset();
  }, -1);
  return null;
}

/** Tells the page when the graphics context is lost, so it can fall back instead of showing a frozen picture. */
function ContextWatch({ onLost }: { onLost: (() => void) | undefined }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!onLost) return;
    const el = gl.domElement;
    const lost = (e: Event): void => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', lost);
    // Removed before the canvas is taken down, so the scene's own shutdown is never mistaken for a loss.
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}
