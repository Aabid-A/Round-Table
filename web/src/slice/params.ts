/** ?mode=slice opens the vertical slice: one round table in WebGL. */
export const isSliceMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'slice';
