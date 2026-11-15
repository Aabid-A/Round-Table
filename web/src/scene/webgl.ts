/** Just what the check needs from a canvas (typed here, so it can be tested without a browser). */
interface Gl {
  getExtension(name: 'WEBGL_lose_context'): { loseContext(): void } | null;
}
interface Doc {
  createElement(tag: 'canvas'): { getContext(kind: 'webgl2'): Gl | null };
}

let webgl2: boolean | null = null;

/** Whether this browser can draw WebGL2. Asked once per page, and the test context is released at once (a browser keeps only a few). */
export function hasWebGl2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = (globalThis as unknown as { document: Doc }).document.createElement('canvas').getContext('webgl2');
    webgl2 = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}
