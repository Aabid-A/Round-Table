/**
 * The colours of the world, as tokens (see /art-direction): near-black blue stone, warm amber light, bone-white masks, one saturated
 * accent per player. Traitor red is for reveals only. Nothing in the scene picks a colour that is not here.
 */
export const PALETTE = {
  stone: '#1a1c26',
  stoneLight: '#2a2d3a',
  floor: '#14151c',
  wood: '#3a2619',
  woodDark: '#241710',
  woodLight: '#5a3d28',
  bone: '#e8dfcc',
  boneShade: '#b9ad94',
  cloak: '#15161d',
  cloakLight: '#23242e',
  amber: '#ffb25a',
  flame: '#ffc978',
  ember: '#ff7a2a',
  coolFill: '#5a6cb4',
  wax: '#d9cfb8',
  iron: '#2c2e38',
  /** Reserved for a mask turned over to show a traitor. */
  traitor: '#b3201e',
  faithful: '#d8b45a',
  robe: '#3b3445',
  /** The short cape over a figure's shoulders: the same cloth, a shade lighter, so the layers read. */
  mantle: '#4a4257',
  robeDeep: '#0d0c10',
  skin: '#a37c63',
} as const;

/** One accent per player. Chosen to stay apart in warm low light, so no two are close in hue and each differs in lightness from its neighbours. */
export const ACCENTS = ['#e0b43a', '#3fa9a0', '#9a5bd1', '#d9743a', '#4b7fd8', '#8dbb4a', '#d95b8a', '#b9c4cf'] as const;
