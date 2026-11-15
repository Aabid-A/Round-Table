# M19 step 1 playtest: slice fixes and the shared scene (`?mode=slice`)

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**. Fixed mock game (seed 14), `?pace=4` for the stills so a slow renderer cannot skip a moment. Played by Playwright: on the phone (390x844) with taps only, so the touch wording shows; on the laptop (1280x720) with the mouse and the keys. Every look described here was seen in a still.

**Files.** Eighteen stills, nine moments at two sizes: `p-*` at 390x844, `d-*` at 1280x720, for `1-speech`, `2-your-turn`, `3-chosen`, `4-accusation`, `5-vote`, `6-tokens`, `7-banishment`, `8-night`, `9-dawn`. `blur-test.png`: the table seen to the left and to the right, sharp above, blurred below (Gaussian, sigma 9). `m19-slice-cut.webm`: 35 s, the whole 34-minute laptop run at medium quality and `?pace=2`, sped up about 58 times, so motion is not real time. `fps.json`: frame rates.

## What the owner's review asked for, and what changed

1. **Portrait vote.** For the vote a tall screen now leans in over the table: the eye rises 0.24 m, comes forward 0.22 m and looks down. The table and the figure across fill the screen from your hands up (`p-5-vote`, `p-6-tokens`); the band of hall above is about a fifth of the screen, not a third.
2. **Touch wording.** The prompts follow the input last used. On the phone they say "Tap a figure to accuse them" and "Tap them again… or swipe to someone else", and the list hides its arrow-key hint (`p-2`, `p-3`, `p-5`). The laptop still names the keys.
3. **Neighbours on the laptop.** The seats beside you now sit 58 degrees round (the rest about 41) and 0.25 m back. Seats 2 and 6 are whole in a 16:9 picture and the two beside you stay out of it until you turn (`d-2` to `d-6`). A neighbour who speaks is turned to fully, so they are whole and not cut by the edge.
4. **Masks.** The slab mask across the table is a bright azure at full light; violet moved to a darker indigo; teal shifted toward green. Every saturated accent is at least 25 degrees of hue from the next, magenta and indigo 50. **Blur test:** seven separate blots (white heart, magenta horns, yellow bar, pale-blue slab, orange lozenge, dark indigo sun, green peak).
5. **Hands.** Each finger bone is lathed: it swells at the joints and narrows between them, and each finger tapers to a tip with a nail. The resting fingers had been sunk into the table, leaving stubs; the hand is now tipped back so the arched fingers and the heel rest on the wood (a test holds it there).
6. **Speech.** The boxed bubble is gone. A figure's words are the turn prompt's pale lit letters, hung beside its mask on the side toward the middle of the picture (`d-1`), and above the mask on a phone where neither side has room (`p-1`). While a figure speaks the depth of field is off (it would blur the words by whatever lies behind them), and the words take no fog. `d-1-speech` was retaken at high quality after that change.
7. **Dawn.** The victim's mask is moved along the table's edge just far enough to clear its plate as you see it, worked out for each seat (`d-9`, `p-9`). The banished mask, which had the same fault, now lies in the middle of the table on your side, tipped up a little less, below the names across the table (`d-7`, `p-7`).

Then the slice's private parts moved into `web/src/scene/` for the other modes: the World composition, the WebGL canvas with its frame meter and lost-context watch, the host (fallback boundary, quality probe, reduced motion, sound), the synthesised sounds, and the choosing keys and list with their styles.

## The seven questions

1. **A stranger: 3D game or web page?** A 3D game at both sizes. The flat things are two small buttons and the folded list.
2. **Mostly dark, light leading the eye?** Yes. Day: the candle-lit table. Night: the fire. Dawn: the shaft on the empty chair.
3. **Told apart at a glance without names?** Yes, by outline and colour, and still when blurred.
4. **Flat card, default material or evenly lit?** No default material or even light. The turned-over mask's gold lining was called "folded paper" by the second opinion when it lay small and flat; it is now near, larger and reads as the inside of a mask (`d-7`, `p-7`).
5. **Text unreadable, clipped or floating free?** Plates are whole or absent. Speech sits beside its speaker. The turn prompt on the phone runs to four lines over the table.
6. **Anticipation, response, settle?** Choosing: the figure lifts and warms under the eye or the finger, the camera turns to it, a second tap or Enter confirms and the hand rises to point. The vote: the camera leans in, the token slides and ticks to rest.
7. **Frozen figure? Camera snap or drift?** None seen in the stills or the video's frames. At about one frame a second smoothness cannot be judged.

## Second opinion on the stills

A context that had not built the scene was given the stills and `/art-direction`, not the code. Its three weakest frames, and what was done:

- **`p-9-dawn`: the murder did not read; the victim's mask was a pale smudge.** The dawn mask is drawn larger (scale 0.2) and every mask on the table is tipped further toward you. It is now a readable shape beside Cleo's plate; on a phone the dark pillar still takes much of the frame.
- **`p-7-banishment`: the turned-over mask read as paper, and lay beside another player's place.** Fixed as above: in the middle of the table on your side, large, below the names.
- **`d-1-speech`: the words were blurred by the depth of field and crossed by flames; the speaking neighbour loomed half cut off.** A neighbour who speaks is now turned to fully, so they are whole (`d-1`, retaken: Aria speaks, whole and pointing). Gate A then showed that hanging the words at the focus distance changed nothing, because the blur reads the depth of what is behind them; a still confirmed it (the words ghosted over a figure). The depth of field is now off while a figure speaks, and the retaken `d-1` shows the words sharp. The words can still lie over the mask of a figure next to the speaker (Bram's, in `d-1`).

Its other point is answered, not fixed: **the plate of the seat beside you sits in front of the next figure** (in `p-1` the speaker's plate reads "Aria" while the figure behind it is the next seat round). From your chair your neighbour sits out to the side beyond the table, so any plate on the table in front of them falls, as you see it, in front of the next seat. M18 had the same geometry. A fix (a plate on the chair, or none for the two beside you) is a design choice for the owner.

## Falls short

- The neighbour's plate, above.
- Speech can lie over the mask of a figure next to the speaker (`d-1`).
- The depth of field is off while anyone speaks, so a close shot loses it for that time.
- Portrait still shows one figure at a time outside the vote; you swipe for the rest.
- Your sleeves still pass through the table's edge from below.
- Still true from M18: a leaving figure glides away seated, a figure's pointing arm has no elbow.
- No frame rate from a real GPU.

## Frame rate

`requestAnimationFrame` deltas over 8 s at high quality, Chromium headless, **SwiftShader software rendering, no GPU on this machine**, while two other browser runs shared the four cores:

| Size | fps | median ms | worst ms |
|---|---|---|---|
| 1280x720 high | 0.6 | 1267 | 6000 |
| 390x844 high | 1.9 | 567 | 1633 |

This says nothing about real devices. The low-quality budget (under 150 draw calls and 200k triangles) is held by `slice.e2e.ts`.
