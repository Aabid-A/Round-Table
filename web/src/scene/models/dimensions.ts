/** The table's size and where the chairs stand, in metres. Kept apart from the drawing so layout and its tests need no renderer. */
export const TABLE_R = 1.55;
export const TABLE_Y = 0.78;
/** How far from the middle the chairs stand. */
export const SEAT_R = 2.35;
/** Where the player's eye is: this far from the middle along +z, at this height. The candles are placed by it. */
export const EYE_Z = 2.62;
export const EYE_Y = 1.22;
/** How far a banished player's mask lies to the side of the middle, toward their place (see layout.banishedMaskSpot). */
export const BANISHED_REACH = 0.28;
/** A banished player's mask is drawn at scale 0.2: about 0.19 m either side of its middle. */
export const BANISHED_MASK_HALF = 0.19;
/** A mask left on the table is drawn at this scale (its outline is about two units tall). */
export const TABLE_MASK_SCALE = 0.2;
/** The one found at dawn lies nearer its empty chair, so the morning light and the eye take in both together. */
export const DAWN_REACH = 0.92;
/** The mask found at dawn is drawn at this size, about 0.19 m either side of its middle. */
export const DAWN_MASK_SCALE = 0.2;
export const DAWN_MASK_HALF = 0.19;
/** A name plate's lettered face, in metres. */
export const PLATE_W = 0.4;
export const PLATE_H = 0.135;
