# M18 playtest: the vertical slice (`?mode=slice`)

**How it was run.** Vite dev server, Chromium 1243 headless with WebGL2 through **SwiftShader (software)**, fixed mock game (seed 14), driven by Playwright with real pointer, keyboard and the choice form: speeches, accuse, point, vote, tokens, banishment, night, dawn, end. `?pace=3` (every moment three times longer) so a slow software renderer cannot skip a moment while a still is taken. WebGL did render, so every look described here was seen in a still.

**Files.** Short video `m18-slice-cut.webm` (36 s: the full 3.5 minute run sped up six times, so motion is not real time). Six desktop stills 1280x720: `1-speech` to `6-dawn`; two phone stills 390x844: `mobile-accuse`, `mobile-mask`. `fps.json`: frame rates.

## Rounds

Three fix rounds, then a second opinion and one more fix pass from it.
1. Flames and bright wood drew coloured speckle (film grain on bright pixels); flames were white sticks. Fixed: grain as a gentle overlay after tone mapping, flame as an unlit material, softer bloom.
2. Camera turned too far; own forearms were heavy logs; turned-over masks were unreadable lumps under depth-of-field; the phone view was a thin strip; the choice panel covered the caption. Fixed: clamped look, thinner arms, upright lit masks, wider vertical view in tall windows, caption moved up on phones.
3. Speech bubble clipped off the picture; masks blown out; dawn looked like night. Fixed: bubble kept on screen, dimmer table masks, stronger dawn light, cuff in your own mask colour on your sleeve.
4. From the second opinion (a separate context given only the stills and `/art-direction`): the caption repeated the bubble (now read aloud but hidden while a bubble shows), the speaker was out of the picture (camera now turns far enough), name plates unreadable (now standing placards), masks too small (bigger).

## The seven questions

1. **A stranger: 3D game or web page?** On desktop, a 3D game: candles, wood grain, bloom, stone, a fire, real depth. On a phone it is closer to a web page with a 3D band: the choice panel takes about a third of the screen.
2. **Mostly dark, light leading the eye?** Yes. The candle-lit table pulls the eye; the walls and far chairs fall away. Night and dawn are very dark.
3. **Told apart at a glance without names?** Partly. Mask shapes differ (diamond, kite, crescent, shield, horn) and plates carry names, but at table distance the masks are all the same pale tan, the accent is a small dot or a sash, and the unlit robes hide it. A stranger would still need the plates. **Falls short.**
4. **Flat card, default material or evenly lit?** No flat cards or default materials; lighting is uneven with shadows. The figures' bodies are unlit-looking egg shapes and their hands are small spheres: cheap.
5. **Text unreadable, clipped or floating free?** Speech is anchored by the speaker's head and clamped on screen; when the speaker is off to the side it sits at the edge, near but not on them. Plates are readable up close, small across the table. HUD and caption are flat and quiet.
6. **Anticipation, response, settle?** See the PR. Pointing: the camera and heads ease, then the hand rises, then the table looks. Vote: a token lifts, slides and settles. Banishment: chair eases back, figure rises and leaves, mask rolls over, then quiet. Night: candles go out one at a time, with a wisp of smoke. Dawn: light rises on an empty chair and the mask. The pointing arm of a figure is stiff and was hard to see in stills.
7. **Frozen figure? Camera snap or drift?** Figures breathe, turn heads and lean (seen in stills and a few video frames; the video was not reviewed frame by frame, so a brief freeze could have been missed). The camera is eased by code, with no cuts, and has no idle drift beyond a small breathing sway. A dropped frame under software rendering looks like a stutter, not a snap.

## Fail list (`/art-direction`)

- Reads as flat cards: no.
- Default or unlit materials, visible grid, plain background: no, except the figures' hands and flames, which are deliberately unlit.
- Evenly lit: no.
- **Humanoid models with stiff or sliding limbs: partly hit.** Figures are capsule-and-cone bodies with stiff arms; the second opinion called them "egg-bodied blobs with cylinder arms". Not fixed.
- Emoji, icons, chrome in the world: no. The gold rings under the table masks read as markers; the second opinion called them debug-like.
- **Two players that can be confused at a glance: partly hit** (question 3).

## Second opinion: three weakest frames

1. Phone speech: duplicate caption and bubble, bubble not on the speaker, scene squeezed. Duplicate removed; speaker brought into view. Phone is still cramped.
2. Desktop speech: bubble pinned at the corner, a dark blob in the foreground eating a third of the frame. Bubble now follows the speaker; the foreground figure (your neighbour, 1.7 m away) is still large and dark.
3. Phone accuse: a full flat form under a flat caption. Caption moved up; the form is still large. A smaller control for phones is a follow-up.

Runners-up, night and dawn: nearly black; the empty chair is hard to read. Not fixed beyond the stronger dawn light.

## Frame rate and how it was measured

`requestAnimationFrame` deltas over 10 s, after 3 s warm-up, Chromium headless with **SwiftShader software rendering on a build sandbox with no GPU**: 1280x720 high 0.9 fps, medium 1.4, low 2.1; 390x844 high 2.6, medium 4.4, low 7.8 (`fps.json`). This says nothing about a real GPU. It does show quality levels are ordered (low about 2x cheaper than high at desktop size). No 50 or 60 fps claim is made. The page's own quality probe would choose `low` here; a person with a GPU needs to check it.

## Verdict

Mood, light and the staged moments work and were seen. Not ready to call finished: figures and hands are cheap, masks are hard to tell apart across the table, night and dawn are too dark, the phone layout is cramped. Owner's call.
