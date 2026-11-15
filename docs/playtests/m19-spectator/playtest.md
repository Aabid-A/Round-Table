# M19 step 3 playtest: the all-seeing room (spectator) in the 3D room

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**. The sample game (`tests/fixtures/sample-game.json`, Bram and Cleo the traitors) and, for a recruitment, the mock game of seed 2 (Esme recruits Cleo). Each moment was reached as a viewer reaches it: open `?view=spectator`, step with the arrow keys. Stills are of the room as it sits on the replay page, at 390x844 (`p-*`) and 1280x720 (`d-*`), high quality; the stills and the video set `?quality=`, which skips the frame-time probe (on this software renderer the probe would otherwise show the flat page). They were taken at `47e34af`; the commit after it (`471500c`) changes only how the night speaker light fades in and out, not how it looks once lit.

**Files.** Fourteen stills: `1-roles-at-night` (a traitor's night proposal, with her private notes), `2-whisper-lines`, `3-accusation-with-notes`, `4-vote-wide`, `5-banishment`, `6-dawn`, `7-recruitment`. `m19-spectator-cut.webm`: 30 s, the all-seeing room playing on its own from the first night to the first banishment at medium quality, sped up. `fps.json`: frame rates.

## What the all-seeing room does now

- It plays in the WebGL room, filmed by the director from no chair (the same rig as the public table in step 2).
- **Roles above the seats:** every living player's role hangs over their hood: a gold ring for a faithful, a red blade for a traitor. Two shapes, so the role is read without the colour. Only a view from no chair that holds living roles gets them, which is this one; a seat's view and the public table never do (tests hold this).
- **Private notes:** the speaker's notes hang in the same column as what they said, beneath it, slanting and in a cold grey-blue, a size smaller: an aside, not the headline. At most five lines in the room; the live region reads all of it.
- **Whispers:** a violet thread drawn over the table from one mask to the other; the director pulls back so both ends are in the picture, and the room dims around it.
- **The director:** a push-in on whoever speaks, wide for the votes and the banishment, held on the one being recruited. At night, with the candles out, a dim warm light finds whoever speaks.
- The room's prompt says only the moment (the notes and whispers are drawn in the room); the live region still reads the notes and whispers in full.
- **Unchanged:** `?view=spectator`, the A key, the View list, clicking a figure to drop into that seat at the same moment, the live region. The flat CSS room is the fallback.

## The seven questions

1. **A stranger: 3D game or web page?** The room is a 3D game in a window on the replay page.
2. **Mostly dark, light leading the eye?** Yes; at night the speaker's light now leads it (`d-1`, `p-1`).
3. **Told apart at a glance without names?** Yes for the masks that face the camera; in the dark frames (the wide dawn, and the recruitment held on Cleo) the far figures are mostly outlines.
4. **Flat card, default material or evenly lit?** No default materials; the room is not evenly lit. The name plates are lettered iron plates.
5. **Text unreadable, clipped or floating free?** Speech and notes sit in one column beside the speaker. On a phone the wide shots' caption lies over the near plates. The notes carry the mock game's test ids ("MOCKNOTE-…"), which a real game's notes do not have.
6. **Anticipation, response, settle?** Stepping cuts the director to the new shot; the whisper thread draws itself from whisperer to listener; the speaker light fades between speakers (from `471500c`).
7. **Frozen figure? Camera snap or drift?** None seen. Cuts are on events, glides otherwise.

## Second opinion on the stills

A context that had not built it was given the stills and `/art-direction`, not the code. Its three weakest frames, and what was done:

- **`1-roles-at-night`: almost black; the speaking traitor could not be seen; the notes read bigger than the speech.** A dim warm light now finds whoever speaks at night, and the notes are a size smaller.
- **`7-recruitment`: nothing staged, the same wide shot, "Recruitment. Recruitment."** The director now holds on the one being recruited, and the prompt says an event's title once.
- **`5-banishment` (and `4`, `6`): the phone caption over the plates; dawn's candles out.** The doubled words are fixed. Answered, not changed: dawn follows the night, so the candles are out and the morning light does the work (as M18 staged it); the caption over near plates in a wide phone shot remains.

Also: the whisper line showed only one end; the director now pulls back for a whisper. Gate A then found two faults in the first fixes (the notes could cover a taller speech; the speaker light was added and removed, rebuilding every shader), both fixed: see the PR.

## Falls short

- On a phone the wide shots' caption lies over the near name plates.
- The recruitment frames (`d-7`, `p-7`) are almost black apart from Cleo: a recruitment has no speaker, so the night speaker light does not reach it.
- The role markers are small; the red blade can read as a pin.
- The plate of a seat's neighbour still sits in front of the next figure (step 1's open point).
- No frame rate from a real GPU.

## Frame rate

`requestAnimationFrame` deltas over 8 s in the all-seeing room at high quality, Chromium headless, **SwiftShader software rendering, no GPU on this machine**: 2.6 fps at 1280x720 (median 383 ms), 1.6 fps at 390x844 (median 700 ms). This says nothing about real devices.
