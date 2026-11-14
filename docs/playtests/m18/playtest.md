# M18 playtest: the vertical slice (`?mode=slice`), second polish pass (phone first)

**How it was run.** Vite dev server, Chromium 1243 headless with WebGL2 through **SwiftShader (software)**. This machine has no GPU (the renderer string is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`). Fixed mock game (seed 14), driven by Playwright with a real pointer, synthetic touch swipes and the keyboard. `?pace=4` for the stills so a slow software renderer cannot skip a moment. WebGL did render, so every look described here was seen in a still.

**Files.** Twelve stills, six moments at two sizes: `p-*` at 390x844 and `d-*` at 1280x720, for `1-your-turn`, `2-accusation`, `3-vote`, `4-banishment`, `5-night`, `6-dawn`. `blur-test.png`: the table seen to the left and to the right, sharp beside blurred (Gaussian, sigma 9). `m18-slice-cut.webm`: 37 s, the whole 172 s desktop run at 4.7 times speed, so motion is not real time (the renderer made about 1.2 frames a second; every frame it drew is in the video). `fps.json`: frame rates and frame cost. Earlier stills are in the history (`1060ce7` before any polish, `1a99292` after the first pass).

No reference images: `design-references/game/` holds only its README, so the written `/art-direction` was the guide.

## What this pass changed

Each item was changed, run in the browser at 390x844 first, looked at in a still and changed again until the still looked right.

1. **Portrait framing.** A tall window gets a closer, level view (52 degrees tall). Your hands and the table's near edge sit on the bottom of the screen; there is no floor under them. The figure you face, the table and the fireplace fill the height.
2. **Swipe and name plates.** On a touch screen you swipe to look round the table; the look comes to rest facing the nearest figure, turns to a speaker, and turns to a figure you choose. A swipe that ends on a figure does not choose it. A name plate that the edge of the picture would cut fades out whole and comes back whole (at every window size).
3. **Masks.** Bolder outlines (a wide face under one tall peak, eight long rays, a wide lozenge, a square slab, a face a third as wide as tall, a small face under two great horns, a broad heart), and each whole face tinted toward its player's colour, lighter or darker by design. Teal, orange and magenta were pushed apart for candlelight. **Blur test:** in `blur-test.png` the seven are a white heart, a magenta horned blot, a yellow bar, a grey-blue square, an orange lozenge, a pink star and a green peak. Each is still its own blot. The two nearest in hue are the magenta horns and the pink star, which sit on opposite sides of the table.
4. **Your sleeves and hands.** Sleeves in long folds with creases where the cloth gathers; a deep turned-back cuff with a rolled edge in your colour; hands a quarter larger again and clear of the cuff.
5. **Flames.** A flame is a teardrop with a paler core and keeps its outline as it flickers. Bloom is about a third of what it was and takes only the brightest light. The candle lights sit above the flames, so the wax is no longer burnt white.
6. **The turn prompt.** Pale lit words that hang over the table in front of you with no box, hold while they are read and fade away. They follow your look slowly. The page's caption box is gone from the 3D room; the same words still go to the live region.

Also: for the vote a tall window pulls back to show three seats and the tokens; a banished player's mask lies well in from its plate and clear of the fire; at dawn only the victim's mask is on the table, near the empty chair, and the camera turns to take in both.

## The seven questions

1. **A stranger: 3D game or web page?** A 3D game at both sizes. The flat things left are two small buttons and one folded control.
2. **Mostly dark, light leading the eye?** Yes. Day: the candle-lit table. Night: the fire. Dawn: the shaft on the empty chair.
3. **Told apart at a glance without names?** Yes, by outline and by colour, and still when blurred.
4. **Flat card, default material or evenly lit?** No.
5. **Text unreadable, clipped or floating free?** Plates are whole or absent, never cut. The caption is in the room. A figure's speech is still a small boxed bubble above its head.
6. **Anticipation, response, settle?** As in the first pass. On a phone a tap chooses, the camera turns to the chosen figure, a second tap confirms.
7. **Frozen figure? Camera snap or drift?** Not seen in the stills or the contact sheet of the video. At about one frame a second smoothness could not be judged.

## Falls short

- **Portrait shows one figure at a time** (three during the vote). That is the price of filling the screen; you swipe for the rest. During the vote the top third of the screen is the dark upper hall.
- **The plates of the four seats nearest you are not under their figures in portrait.** From your seat the line of sight to those figures does not cross the table, so when you face one of them its plate is out of the picture.
- **The dawn mask overlaps a corner of its own name plate** from your seat (`d-6-dawn`, `p-6-dawn`).
- **Magenta and pink** are the closest pair under candlelight.
- **Your hands** have spread, sausage-like fingers; they read as hands, not as fine ones.
- Still true from the first pass: a leaving figure glides away seated, the pointing arm of a figure has no elbow, a figure seen close from the side is plain below the cape, the pushed-back chair does not read by day.
- **No second opinion on the stills in this pass** and no frame rate from a real GPU.

## Frame rate and frame cost

`requestAnimationFrame` deltas over 10 s after a 3 s warm-up, Chromium headless, **SwiftShader software rendering, no GPU on this machine**:

| Size and level | fps | median ms | draw calls | triangles |
|---|---|---|---|---|
| 1280x720 high | 0.8 | 1233 | 401 | 418k |
| 1280x720 medium | 1.2 | 833 | 418 | 424k |
| 1280x720 low | 2.1 | 467 | 90 | 70k |
| 390x844 high | 1.9 | 500 | 319 | 383k |
| 390x844 medium | 2.8 | 350 | 305 | 379k |
| 390x844 low | 5.9 | 167 | 19 | 31k |

Draw calls and triangles count every pass of a frame. At low there is one pass and no shadows, so that row is the scene itself and is inside the budget (150 calls, 200k triangles); a browser test holds it there. At high and medium the three shadow-casting lights draw the scene again and take the total past the budget. This says nothing about the frame rate on a real GPU: no 60 or 30 fps claim is made, and a person with a GPU needs to check it.

## Verdict

The six items asked for are done and each was seen in a still at both sizes. Not finished: see "Falls short". Owner's call.
