/** Your hands are drawn a little over life size, so the fingers read at the bottom of a small screen. */
export const HAND_SCALE = 1.65;

/**
 * How a hand of yours rests on the table: the wrist `lift` above the wood, tipped back by `pitch` so the arched fingers and the heel
 * of the hand both touch it, and turned in by `yaw` (only a little, so from your eye the fingers lie side by side, not stacked).
 */
export const REST_POSE = { lift: 0.042, pitch: -0.15, yaw: -0.26 } as const;
