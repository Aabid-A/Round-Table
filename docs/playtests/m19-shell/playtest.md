# M19 step 7 playtest: the game shell

**How it was run.** Vite dev server, Chromium headless with WebGL2 through **SwiftShader (software rendering, no GPU on this machine)**. A solo game against the practice AIs, seed 1 (you are a traitor, Bram your partner), played from the title screen to the end through the shell: the name typed on the plate, the role reveal, choices made in the room or with the input bar's buttons, Send. Stills of the whole window at 390x844 (`p-*`, a phone: touch) and 1280x720 (`d-*`), quality medium (`?quality=` skips the frame-time probe). Only the six stills the owner asked for; no video.

**Files.**

- `*-title`: the front door. The camera drifts round the empty table; "Round Table"; Play, Play with friends, Watch an episode; a small line to open a log or the stats.
- `*-name`: the setup at the table. Your name is lettered on the plate in front of you as you type it; practice AIs are the default; "Use real AI models" opens the key panel.
- `*-reveal`: your mask turned over in your hands: "You are a traitor. Your partner: Bram", held until Take your seat.
- `*-turn`: your first turn, the night: the input bar over the bottom of the room ("Click a figure" on a desktop, "Tap a figure" on a phone), Send; the HUD (Night · Round 1; Journal, Sound, Menu).
- `*-journal`: what you know, slid over the room (J on a desktop, the Journal button on a phone).
- `*-ending`: the masks turned over before their chairs, "The traitors win", then Play again, Watch the replay, Share, Details.

## The seven questions

1. **A stranger: 3D game or web page?** A game: the room fills the window in every still; no page title, no cream page, nothing scrolls.
2. **Mostly dark, light leading the eye?** Yes: candles, the fire, the light on the plate and on the held mask.
3. **Told apart at a glance without names?** Yes for the masks facing you.
4. **Flat card, default material or evenly lit?** The flat parts are the HUD, the input bar, the journal and the setup's plate field, all small and dark over the room.
5. **Text unreadable, clipped or floating free?** On a phone the setup's name field covers the 3D plate it letters (`p-name`); the 3D plate shows on a desktop (`d-name`).
6. **Anticipation, response, settle?** The mask is held face down, turns over, then the words come up; at the end the masks turn, then the result, then the buttons.
7. **Frozen figure? Camera snap or drift?** The title camera drifts on purpose, slowly (one turn round the table in 140 s); nothing else drifts.

## Falls short

- On a phone the name field covers the 3D plate (`p-name`).
- The result step of a replay and the guess game's score page are still flat pages.
- A timed turn (rooms) lets the role reveal give way after five seconds instead of holding it until a click, so the reveal never costs the turn.
- The phone's keyboard handling (the bar above the keyboard) was built from the visual viewport and `interactive-widget=resizes-content`, and checked only in an emulated phone without an on-screen keyboard; not on a device.
- No frame rate measured for this step; no video.
