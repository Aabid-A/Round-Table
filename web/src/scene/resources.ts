import { createContext, useContext } from 'react';

export interface Disposable {
  dispose(): void;
}

/**
 * Everything one mounted scene has built for the graphics card: geometries, textures. Each is made once under a name and shared by
 * whoever asks for that name (seven chairs, one wood texture), and all of it is released together when the scene is taken down.
 */
export class SceneResources {
  private made = new Map<string, Disposable>();

  get<T extends Disposable>(key: string, make: () => T): T {
    const have = this.made.get(key);
    if (have) return have as T;
    const fresh = make();
    this.made.set(key, fresh);
    return fresh;
  }

  get size(): number {
    return this.made.size;
  }

  /** Release everything. What was made can still be drawn again (it is simply uploaded again), so a late frame cannot break. */
  disposeAll(): void {
    for (const r of this.made.values()) r.dispose();
    this.made.clear();
  }
}

/** Several things released as one (a colour map and its bump map). */
export function together<T extends Record<string, Disposable>>(parts: T): T & Disposable {
  return { ...parts, dispose: () => Object.values(parts).forEach((p) => p.dispose()) };
}

export const ResourcesContext = createContext<SceneResources | null>(null);

/** A shared resource of the scene this component is drawn in: built on first use, kept under `key`, released with the scene. */
export function useResource<T extends Disposable>(key: string, make: () => T): T {
  const store = useContext(ResourcesContext);
  if (!store) throw new Error('useResource needs a scene (ResourcesContext)');
  return store.get(key, make);
}
