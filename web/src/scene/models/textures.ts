import * as THREE from 'three';

/** A small seeded random number generator, so a texture is the same every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat: number, colour: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Block stone: mortar lines and mottled blocks. Returns a colour map and a bump map made from the same blocks. */
export function stoneMaps(base: string, repeat = 3): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [c, g] = canvas(size);
  const [b, bg] = canvas(size);
  const r = rng(11);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, size, size);
  const rows = 8;
  const h = size / rows;
  for (let row = 0; row < rows; row++) {
    const cols = 3 + (row % 2);
    const w = size / cols;
    for (let col = 0; col < cols; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0) - w / 2;
      const shade = 0.78 + r() * 0.4;
      g.fillStyle = `rgba(${Math.round(255 * shade * 0.5)},${Math.round(255 * shade * 0.52)},${Math.round(255 * shade * 0.62)},0.5)`;
      for (const dx of [0, size]) g.fillRect(x + dx + 2, row * h + 2, w - 4, h - 4);
      bg.fillStyle = `rgb(${Math.round(120 + r() * 60)},${Math.round(120 + r() * 60)},${Math.round(120 + r() * 60)})`;
      for (const dx of [0, size]) bg.fillRect(x + dx + 3, row * h + 3, w - 6, h - 6);
    }
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * size;
    const y = r() * size;
    g.fillStyle = `rgba(0,0,0,${r() * 0.16})`;
    g.fillRect(x, y, 1 + r() * 3, 1 + r() * 3);
    bg.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.1)`;
    bg.fillRect(x, y, 2, 2);
  }
  return { map: finish(c, repeat, true), bump: finish(b, repeat, false) };
}

/** Wood grain: long streaks along one direction. */
export function woodMaps(base: string, repeat = 2): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [c, g] = canvas(size);
  const [b, bg] = canvas(size);
  const r = rng(5);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const y = r() * size;
    const wob = r() * 6;
    const dark = r() > 0.5;
    g.strokeStyle = dark ? `rgba(0,0,0,${0.08 + r() * 0.2})` : `rgba(255,220,170,${0.03 + r() * 0.08})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * wob);
    g.stroke();
    bg.strokeStyle = `rgba(${dark ? 40 : 200},${dark ? 40 : 200},${dark ? 40 : 200},0.35)`;
    bg.lineWidth = 1 + r() * 1.5;
    bg.beginPath();
    bg.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) bg.lineTo(x, y + Math.sin(x / 70 + i) * wob);
    bg.stroke();
  }
  return { map: finish(c, repeat, true), bump: finish(b, repeat, false) };
}

/** A name plate: bone-white lettering on dark iron, large enough to read from across the table. */
export function plateTexture(name: string, accent: string): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  c.height = 96;
  g.fillStyle = '#1b1c24';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = accent;
  g.fillRect(0, 0, 256, 8);
  g.fillStyle = '#efe6d2';
  g.font = '600 46px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 128, 54, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
