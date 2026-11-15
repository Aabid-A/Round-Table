# M19 step 5 playtest: rooms, the ghost and the watch link in the 3D room

**Not run.** The owner asked to wrap up steps 4 to 6 with the stills already taken, and none had been taken for rooms. There are no stills, no video and no second opinion for this step.

**What stands in for it.** Rooms use the same live seat as the solo game, whose stills are in `docs/playtests/m19-solo/`, and the watch link uses the all-seeing room from step 3 (`docs/playtests/m19-spectator/`). The browser tests in `web/e2e/rooms-3d.e2e.ts` open each new view in the 3D room under SwiftShader and check what it shows:

- a room's seat from your own chair, with the turn's candle on the table (`data-timer="shown"`);
- `?fallback=1` keeping the flat room;
- a ghost sitting in the chosen seat's chair, and moving when another seat is picked;
- the watch link's game in the all-seeing room, with a role over every seat.

## Falls short

- No look at a room's seat, a ghost or the watch link in a still or a video.
- No frame rate measured for this step; the solo seat's (`docs/playtests/m19-solo/fps.json`) is the same room.
