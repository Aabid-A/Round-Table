# M18 playtest: the vertical slice (`?mode=slice`), after the polish pass

**How it was run.** Vite dev server, Chromium 1243 headless with WebGL2 through **SwiftShader (software)**. This machine has no GPU (`/dev/dri` is absent; the renderer string is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`). Fixed mock game (seed 14), driven by Playwright with a real pointer and keyboard: look around, hover a figure, select it twice to accuse, select twice to vote, tokens, banishment, night, dawn, end. `?pace=4` for the stills so a slow software renderer cannot skip a moment. WebGL did render, so every look described here was seen in a still.

**Files.** `m18-slice-cut.webm`: 36 s, the whole 174 s run at 4.7 times speed, so motion is not real time (the renderer made about 1.2 frames a second; every frame it drew is in the video). Desktop stills 1280x720: `1-speech`, `2-accuse` (pointer on a figure), `2b-selected`, `2c-pointing`, `3-vote-tokens`, `4-banish-mask`, `5-night`, `6-dawn`. Phone stills 390x844: `mobile-accuse` (after one tap), `mobile-mask`. `fps.json`: frame rates and frame cost. The stills from before this pass are in the history at commit `1060ce7`.

No reference images: `design-references/game/` holds only its README, so the written `/art-direction` was the guide.

## What this pass changed, item by item

Each was changed, run in the browser, looked at in a still and changed again until the still looked right.

1. **Figures.** The capsule bodies are gone. Each figure is one draped cloak with folds from shoulder to floor, a short cape that gives it shoulders (its hem in the wearer's colour), a clasp, and a deep hood round the mask. Arms stay inside; a sleeve and a shaped hand come out on a spring only to point.
2. **Masks.** One solid mesh each: a curved face with a brow, a nose and set-in eyes, real thickness, a rim in the wearer's colour and the emblem raised on the brow. Outlines pushed apart (egg, crest, rays, lozenge, shield, long, horns, disc). A head never turns more than 0.7 radian from the viewer, so no mask is edge-on. The mask left on the table leans toward you and is turned over to show a gold or red lining; the ring under it is gone.
3. **Your body.** Two forearms in sleeves with a band of your mask's colour on the cuff, and hands with a palm, four jointed fingers and a thumb resting on the table. The right one rises and aims a finger at the mask you accuse.
4. **Acting in the world.** No panel in the default view. You look at a figure and select it; it sits up, turns to you, its mask warms and a light in its colour comes up in front of it; its plate brightens; the pointer changes. Selecting it again confirms. The list of names is folded behind "Choose from a list" (keyboard and screen reader); arrow keys and Enter work without opening it.
5. **Name plates.** Iron blocks with the name drawn at 1024 pixels with mipmaps, turned to face your seat. The depth of field that blurred them now blurs only the far wall. The candles were moved so none stands in front of a mask or a plate from your seat.
6. **Night and dawn.** At night the fire's glow carries across the table and a faint cold light picks out the masks; the empty chair stands against the fire. At dawn one shaft from a high window falls on the empty chair, its plate and the mask.
7. **The rest.** Reduced motion (no breathing, sway, flicker, grain or slides; poses cut; the look still follows the pointer). Everything the scene builds is released when it is taken down. Seven chairs are one shared mesh and one wood texture; ten columns are one mesh. On a phone the view is closer (74 degrees tall) and more level and the head turns further. The page falls back to the plain version if the graphics context is lost.

## The seven questions

1. **A stranger: 3D game or web page?** A 3D game, on desktop and on a phone. The only flat things are two small buttons, one folded control and a caption.
2. **Mostly dark, light leading the eye?** Yes. Day: the candle-lit table. Night: the fire. Dawn: the shaft on the empty chair.
3. **Told apart at a glance without names?** By outline, yes, for the five seats in front of you; the two beside you are at a slant and partly out of frame until you turn. By colour, not fully: two pairs of rim colours come close under candlelight (see the second opinion).
4. **Flat card, default material or evenly lit?** No. The name plates are lettered faces on solid blocks.
5. **Text unreadable, clipped or floating free?** All seven plates read from your seat. Speech sits above its speaker; it can cover the top of the speaker's hood. The plates of the two seats beside you run off the edge of a phone screen until you turn.
6. **Anticipation, response, settle?** Accuse: hover (figure sits up, turns, glows), select (held light, a tick), confirm (your hand rises on a spring, settles, the table turns to look). Vote: the same choice, then tokens lift, slide and settle. Banishment, night and dawn as before, with the mask now turned over to its lining.
7. **Frozen figure? Camera snap or drift?** Figures breathe, shift their weight, turn head and shoulders. The video was reviewed as a contact sheet and not frame by frame. At about one frame a second every move looks like a jump; that is the renderer here, and could not be judged for smoothness.

## Fail list (`/art-direction`)

- Flat cards, default materials, grid, plain background: no.
- Evenly lit: no.
- **Stiff or sliding limbs: partly.** A figure leaving still glides back into the dark as a seated shape; it does not stand and walk. The pointing arm is one sleeve that swings from the shoulder with no elbow.
- Emoji, icons, chrome in the world: no.
- **Two players confused at a glance: partly.** Outlines differ; two pairs of rim colours come close under candlelight. Your own gold cuff is close to the amber of the light.

## Second opinion

A separate context was given the ten stills and `/art-direction`, not the code, and asked for the faults. Two of the stills it saw (`2b`, `2c`) were stale, taken before the plates and candles were moved; they have been retaken. What it said and what was done:

- **Dawn was the darkest frame, hands gone, gold cuffs floating in black.** Fixed: a grey morning light under the shaft; the cuff no longer glows by itself. Hands and figures now read at dawn.
- **Night looked like a blue filter, the wall brighter than by day, plates glowing.** Fixed: the cold light is cut by two thirds and a weak warm glow is thrown back from the wall behind you, so faces are warm; the fire is lower; plates are dimmer. The dark wedge down the table at night is the shadow of the pushed-back chair in front of the fire. Left.
- **Your arms were fat tubes with sawn-off ends, tiny dark mitts for hands, a wire for a cuff.** Fixed: the sleeves run out of the bottom of the picture, the hands are larger and lighter, the cuff is a deep band.
- **No readable pointing hand.** Fixed (and the still was stale): the finger is seen from the side, aimed at the mask.
- **Plates of the two seats beside you were oversized cards.** Fixed: those two are 0.7 size.
- **Selected looked like hover.** Partly fixed: the chosen figure is lit more strongly and its plate is brighter. It is still the same kind of response, only stronger.
- **Phone was a thin band with half the screen black and tiny figures.** Fixed: a closer view (74 degrees tall); three figures fill the width and you turn to see the rest.
- **Vote tokens small and dim.** Fixed: larger, glowing in their owner's colour. They still do not say at a glance whose name they sit by.
- **Speech had no tail.** Fixed.
- **Near figures are smooth below the cape.** Deeper folds added to the chest and lap; a figure seen close from the side is still plain below the cape. **Falls short.**
- **Esme and Aria both read green; Finn and Cleo both red and pointed.** Not fixed. Under amber light teal reads green and pink reads red. Their outlines differ (long face, crest, horns, lozenge) but the colours need retuning for candlelight. **Falls short.**
- **The mask on the table merges with the flames** when the empty seat is the one in front of the fire (stills 4 and 5). Not fixed. **Falls short.**
- **The pushed-back chair does not read at a banishment by day.** Not fixed; it reads at night against the fire and at dawn in the shaft.
- **Table grain harsh; rim colour on a hood like an outline.** Not changed in this pass.
- "Candles change count between stills" and "a gaping mouth on Aria's mask" were the stale stills and an eye socket seen from the side.

The second opinion was not asked again after these fixes (one round).

## Frame rate and frame cost

`requestAnimationFrame` deltas over 10 s after a 3 s warm-up, Chromium headless, **SwiftShader software rendering, no GPU on this machine**:

| Size and level | fps | median ms | draw calls | triangles |
|---|---|---|---|---|
| 1280x720 high | 0.8 | 1200 | 401 | 377k |
| 1280x720 medium | 1.3 | 800 | 388 | 374k |
| 1280x720 low | 2.1 | 450 | 87 | 63k |
| 390x844 high | 2 | 517 | 361 | 360k |
| 390x844 medium | 3.1 | 317 | 347 | 356k |
| 390x844 low | 6.2 | 167 | 46 | 45k |

Draw calls and triangles count every pass of a frame. At low there is one pass and no shadows, so that row is the scene itself and is inside the budget (150 calls, 200k triangles); a browser test holds it there. At high and medium the three shadow-casting lights (two of them point lights, six faces each) draw the scene again and take the total past the budget. This says nothing about the frame rate on a real GPU: no 60 or 30 fps claim is made, and a person with a GPU needs to check it.

## Verdict

The seven items asked for are done and were each seen in a still. It is not finished: rim colours under candlelight, the plain lower cloak seen close, the mask against the fire, a figure that glides away instead of walking, and no frame rate from a real GPU. Owner's call.
