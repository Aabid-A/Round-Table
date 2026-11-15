# M19 step 2 playtest: the replay and the perspective replay in the 3D room

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**. The sample game (`tests/fixtures/sample-game.json`) and, for a recruitment, the mock game of seed 2 (Esme recruits Cleo; the sample game has none). Each moment was reached the way a viewer reaches it: open the address, step with the arrow keys. Stills are of the room as it sits on the replay page, at 390x844 (`p-*`) and 1280x720 (`d-*`), high quality. The stills and the video set `?quality=`, which skips the frame-time probe; on this software renderer the probe would otherwise have shown the flat page (first frames under 10 fps). Every look described here was seen in a still.

**Files.** Fourteen stills: `1-dawn` (the public table at breakfast), `2-whisper-to-you` (seated as Dax as whispers reach him), `3-accusation` (the public table, Dax accuses), `4-vote-tokens` (the public table, the vote counted), `5-banishment` (the public table, Aria banished, the mask turned over), `6-recruitment` (seated as Cleo, recruited by Esme), `7-seated-accusation` (seated as Aria, another player accuses). `m19-replay-cut.webm`: 30 s, the public replay playing on its own from the first night to the first banishment at medium quality, sped up (the renderer made about three frames a second). `fps.json`: frame rates.

## What the replay does now

- **The public table** plays in the room, filmed by a director from no chair: the seats are evenly spaced, every figure is drawn, the name plates and the masks on the table turn to the camera. The director holds a shot of whoever acts from across the table and pushes in slowly; it pulls back wide for the votes, the banishment and the result.
- **A seat's view** (`?seat=`, the View list, or a click on a figure) sits you in that chair in the first person, with your own hands and your mask's colour on your cuffs, everyone else in their own mask.
- **Staged moments**, each from only what that viewer saw: dawn on the empty chair with the victim's mask before it; the speaker pointing at the one accused while heads turn; the votes as tokens on the table (at the public table each vote as it is cast; a seat sees only its own until the count); the banishment beat by beat (the chair, the leaving, then the mask turned over, and the words follow the beats); a whisper reaching your seat (the sender leans in, the room dims, the words beside the sender); a recruitment (in the dark, a mask slid across the table); and players already out leave their masks before their empty chairs.
- **Unchanged:** the URLs, the arrow keys, Space and A, the View list, the step slider and the live region. The flat table and the CSS room are the fallback: no WebGL, `?fallback=1`, reduced motion, a lost graphics context, or first frames under 10 fps. The all-seeing room (step 3), the watch page (step 5) and the result screen are still drawn flat.

## The seven questions

1. **A stranger: 3D game or web page?** The room is a 3D game in a window on a web page: the page's title, View list and controls are around it.
2. **Mostly dark, light leading the eye?** Yes: the candle-lit table by day, the fire at night and in the recruitment, the morning shaft at dawn.
3. **Told apart at a glance without names?** Yes for every mask that faces the camera. A figure seen from behind across the director's shot (Bram in `d-3`) shows only its hood and cape colour.
4. **Flat card, default material or evenly lit?** The name plates are lettered iron plates; no default materials; the room is not evenly lit.
5. **Text unreadable, clipped or floating free?** Speech is beside its speaker. Event words (breakfast, the vote result, the banishment) are a caption over the table and can lie over plates. Three whispers that arrive together make a long block (`d-2`, `p-2`); the words, with their test ids, are the mock game's.
6. **Anticipation, response, settle?** In the code, hovering a figure lifts it and lights it, and a click sits you in that chair: the view cuts into it and the look turns. Hover and click were tested in the browser but not captured in a still or the video. The banishment and the recruitment are moments with a start, a movement and a rest.
7. **Frozen figure? Camera snap or drift?** None seen. The director glides between shots and cuts on events.

## Second opinion on the stills

A context that had not built it was given the stills and `/art-direction`, not the code. Its three weakest frames, and what was done:

- **`p-2-whisper-to-you`: a wall of text over a near-black room, no lean.** The words are now said beside the sender, who leans in, and the room dims less. Answered, not fixed: three whispers reach a seat together by the game's rules, so the block stays long.
- **`p-6-recruitment`: not in the dark, and the slid mask read as a red card.** The recruitment is now staged with the candles out, and the mask is slid face up so its shape reads.
- **`p-5-banishment`: black top half, the reveal did not read, a candle cut the caption.** The director pulls back wide for a banishment; the turned-over mask lies larger before the empty chair; words are drawn after everything else.

Its other points: the tokens lie toward the middle of the table, not on the name plates, so who voted for whom is read from the colours, not the places; the cloak edges and the flames are M18's, approved by the owner.

## Falls short

- At the public table a figure with its back to the camera shows no mask.
- Event words are a caption over the table, not placed by anyone, and can cover plates.
- The whisper block is long when several whispers arrive together.
- The public table's banished mask is drawn a little larger than the fallen mask that replaces it a step later, so it shrinks once (gate A nit).
- All the whisper lines appear beside the first sender (gate A nit; each line names its sender).
- The all-seeing room, the watch page and the result screen are not in the room yet.
- No frame rate from a real GPU.

## Frame rate

`requestAnimationFrame` deltas over 8 s on the public table at high quality, Chromium headless, **SwiftShader software rendering, no GPU on this machine**: 3.0 fps at 1280x720 (median 350 ms), 1.6 fps at 390x844 (median 650 ms). This says nothing about real devices.
