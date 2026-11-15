# M19 step 6 playtest: recording mode and share cards in the 3D room

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**, the sample game (`tests/fixtures/sample-game.json`). The clip stills are whole pages of recording mode at `from=30&to=34` (the first banishment), quality low, 16:9 at 1280x720 (`d-*`) and 9:16 at 405x720 (`p-*`; the stage of a 9:16 clip is the same shape at 390x844). The cards are screenshots of the card at its own size, quality high. These were check stills, taken while building; the owner asked to wrap up with the stills already taken, so there is no still of each staged moment as a clip, no video and no second opinion.

**Files.**

- `*-table`: the public clip, filmed by the director, the words in the room ("Aria's chair is pushed back").
- `*-seat`: Dax's clip, from his chair, the banishment's words.
- `*-split`: Bram and Dax at the same moment, side by side in 16:9, one above the other in 9:16.
- `*-spectator`: the all-seeing clip, a role over every living seat.
- `card-1200x675`, `card-1080x1350`: share cards with the moment in the room behind the player's name.

## The seven questions

1. **A stranger: 3D game or web page?** The clips are the 3D room filling the frame, with nothing laid over it. The cards are flat cards with a picture of the room.
2. **Mostly dark, light leading the eye?** Yes, candlelit table.
3. **Told apart at a glance without names?** Yes for masks facing the camera.
4. **Flat card, default material or evenly lit?** No default materials in the room; the card itself is a flat design, as cards are.
5. **Text unreadable, clipped or floating free?** In 9:16 the caption can lie over a mask (`p-9x16-seat`).
6. **Anticipation, response, settle?** The banishment is staged beat by beat and the clip holds until the mask turns.
7. **Frozen figure? Camera snap or drift?** None seen.

## Falls short

- With no HUD, a two-seat split does not say whose chair each half is, except by the cuffs' colour (the page's `aria-label` names it).
- The wide card's picture is a short strip; the director's shot of a speaker can be mostly dark (`card-1200x675`).
- Stills at low quality, not of every staged moment; no video.
- No frame rate from a real GPU; none measured for this step (the same room as the replay, `docs/playtests/m19-replay/fps.json`).
