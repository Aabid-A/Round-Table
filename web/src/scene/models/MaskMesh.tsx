import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { MASKS, maskOutline, type Emblem } from './masks.js';

function emblemGeometry(e: Emblem): THREE.BufferGeometry {
  const s = new THREE.Shape();
  switch (e) {
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.07 : 0.17;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'ring':
      s.absarc(0, 0, 0.16, 0, Math.PI * 2, false);
      s.holes.push(new THREE.Path().absarc(0, 0, 0.09, 0, Math.PI * 2, true));
      break;
    case 'bar':
      s.moveTo(-0.22, -0.045); s.lineTo(0.22, -0.045); s.lineTo(0.22, 0.045); s.lineTo(-0.22, 0.045);
      break;
    case 'dots':
      s.absarc(-0.13, 0, 0.055, 0, Math.PI * 2, false);
      break;
    case 'cross':
      [[-0.04, -0.17], [0.04, -0.17], [0.04, -0.04], [0.17, -0.04], [0.17, 0.04], [0.04, 0.04], [0.04, 0.17], [-0.04, 0.17], [-0.04, 0.04], [-0.17, 0.04], [-0.17, -0.04], [-0.04, -0.04]].forEach(([x, y], i) => (i ? s.lineTo(x!, y!) : s.moveTo(x!, y!)));
      break;
    case 'drop':
      s.moveTo(0, 0.18); s.quadraticCurveTo(0.16, -0.02, 0.1, -0.1); s.quadraticCurveTo(0, -0.2, -0.1, -0.1); s.quadraticCurveTo(-0.16, -0.02, 0, 0.18);
      break;
    case 'wave':
      s.moveTo(-0.22, -0.02); s.quadraticCurveTo(-0.11, 0.12, 0, -0.02); s.quadraticCurveTo(0.11, -0.16, 0.22, -0.02); s.lineTo(0.22, 0.05); s.quadraticCurveTo(0.11, -0.09, 0, 0.05); s.quadraticCurveTo(-0.11, 0.19, -0.22, 0.05);
      break;
    case 'tri':
      s.moveTo(0, 0.17); s.lineTo(0.17, -0.12); s.lineTo(-0.17, -0.12);
      break;
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  if (e === 'dots') {
    const extra = [new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12).rotateX(Math.PI / 2)];
    extra[0]!.translate(0.0, 0.0, 0.015);
    extra[1]!.translate(0.13, 0, 0.015);
    return g;
  }
  return g;
}

/** A mask as real geometry: an extruded outline with a brow emblem and two eye holes, in its seat's own shape and accent. */
export function MaskMesh({ index, scale = 0.15 }: { index: number; scale?: number }) {
  const design = MASKS[index]!;
  const geo = useMemo(() => {
    const pts = maskOutline(design.shape).map(([x, y]) => new THREE.Vector2(x, y));
    const s = new THREE.Shape(pts);
    for (const ex of [-0.28, 0.28]) {
      const h = new THREE.Path();
      h.absellipse(ex, 0.12, 0.13, 0.07, 0, Math.PI * 2, true, 0);
      s.holes.push(h);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 2 });
  }, [design.shape]);
  const emblem = useMemo(() => emblemGeometry(design.emblem), [design.emblem]);
  return (
    <group scale={scale}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#b9ae98" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh geometry={emblem} position={[0, 0.5, 0.3]}>
        <meshStandardMaterial color={design.colour} roughness={0.4} metalness={0.3} emissive={design.colour} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, -0.55, 0.28]}>
        <boxGeometry args={[0.5, 0.05, 0.02]} />
        <meshStandardMaterial color={design.colour} roughness={0.4} />
      </mesh>
    </group>
  );
}
