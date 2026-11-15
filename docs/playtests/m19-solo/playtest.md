# M19 step 4 playtest: the solo seat in the 3D room

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**. Solo games against the practice AIs, seeded: seed 1 (you are a traitor and your first turn is the night) and seed 6 (a faithful). Each turn was answered with the form, as a player using it would. Stills are of the room alone (`world`), at 390x844 (`p-*`) and 1280x720 (`d-*`), quality high (`?quality=` skips the frame-time probe, which on this renderer would show the flat page).

**What was cut short.** The owner asked to wrap this step up with the stills already taken. There is no video, no banishment or vote still (the banishment screenshot timed out on this renderer), and no second opinion on these stills.

**Files.**

- `p-1-traitor-night`, `d-1-traitor-night`: your first turn as a traitor, at night.
- `p-2-choosing`, `d-2-choosing`: a seat chosen in the room with the arrow keys; the room turns to it.
- `p-3-whispers-turn`, `d-3-whispers-turn`: a faithful's first turn, the whispers.
- `p-4-whisper-to-you`: whispers reaching your seat.
- `p-5-round-table`: the round table opening.
- `p-6-dawn`: breakfast, the one murdered.
- `fps.json`: frame rates.

The three desktop stills were taken before `e15998e`: their Confirm button lies over the bottom of the room. That is the bug the commit fixed (in a live seat the room was 72vh tall in a 60vh box). The phone stills were taken after it.

## The seven questions

1. **A stranger: 3D game or web page?** The room is a 3D game, but it sits in a box on a page with the form under it. Step 7 (the shell) answers this.
2. **Mostly dark, light leading the eye?** Yes: candles by day, the fire at night, the light on the one you choose.
3. **Told apart at a glance without names?** Yes for the masks that face you. At night the far figures are mostly outlines.
4. **Flat card, default material or evenly lit?** No.
5. **Text unreadable, clipped or floating free?** The news is a line over the table; a long whisper makes a block over the top of a phone's view (`p-4`).
6. **Anticipation, response, settle?** A figure lifts and lights under the pointer, and the room turns to the one chosen (`p-2`).
7. **Frozen figure? Camera snap or drift?** None seen.

## Falls short

- No proposal discs show in `p-1`: the traitor's partner had not proposed yet when it was taken.
- The solo game has no time limit, so the turn candle does not show in solo (rooms show it).
- No still of the votes or the banishment in a live seat, and no video.
- No frame rate from a real GPU.

## Frame rate

`requestAnimationFrame` deltas over 8 s in the solo seat at high quality, Chromium headless, **SwiftShader software rendering, no GPU on this machine**: 1.4 fps at 1280x720 (median 800 ms), 2.9 fps at 390x844 (median 17 ms, uneven). This says nothing about real devices.
