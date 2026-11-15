---
name: game-feel
description: Use when building or changing anything the player does or watches happen in the game world - choosing, voting, whispering, phase changes, camera moves, sound. Makes the game respond like a game instead of a form.
---

# Game Feel

The player acts on things in the room and the room answers. Follow
`/art-direction` for what it looks like and `/scene-3d` for how it is built.

## Rules

1. **Act in the world.** To accuse, look at a player and select them. To
   vote, slide your token to a name. To whisper, lean toward a seat. Forms
   exist only as the accessible alternative, out of the way.
2. **Three beats for every action.** Anticipation (hover: the target lifts,
   glows or turns), response (within 100 ms of the click: movement and a
   sound), settle (it comes to rest; the room reacts). No action is a state
   change with nothing moving.
3. **Other players are alive.** They breathe, shift, glance at the speaker,
   react to accusations and reveals. A still figure is a bug.
4. **The camera has intent.** It eases, never snaps, except on a deliberate
   cut. It favours whoever holds the moment. In first person the player can
   always look around.
5. **Time has rhythm.** Phase changes are transitions with weight (candles
   out, dawn light), 1 to 3 seconds, skippable after the first time. Waiting
   for an AI shows that player thinking, not a spinner.
6. **Reveals are staged.** A role reveal, a murder, a banishment each get a
   held beat before the text appears. Never show the result before the moment.
7. **Feedback is diegetic first.** Whose turn, time left, votes cast: show it
   on the table (a candle burning down, tokens) before adding HUD.
8. **Sound.** Room tone, fire, candle snuff, token slide, chair scrape, a
   bell for banishment, a low sting for a murder. Synthesise with the Web
   Audio API or use CC0 files listed in `ASSETS.md`. No voices. Off until the
   player's first click, with a mute control that is remembered.
9. **Input.** Mouse, touch and keyboard all complete every action. Touch
   targets 44 px. Nothing depends on hover alone.
10. **Never trap the player.** Every animation that blocks input is under
    1.5 s or skippable. Reduced motion swaps moves for cuts and fades.

## Shell

The frame around the room. Code: `web/src/shell/`.

1. **Full screen.** In solo, rooms, replay, spectator and guess the room fills the window: no page title, no cream page, no scrolling, dark behind everything.
2. **Title screen.** The front door is the hall: the camera drifts slowly round the table, "Round Table", and Play, Play with friends, Watch an episode. The `?mode=` addresses still work.
3. **Setup in the world.** You letter your name on the plate at your seat. Opponents are practice AIs by default; real models sit behind one small "Use real AI models" control that opens the key panel.
4. **Role reveal.** Your mask turns over in your hands with your role and, for a traitor, your partner. It is held until you click.
5. **Acting.** Click a figure to choose. One input bar over the bottom of the scene takes speech or a whisper, with Send. No Confirm button and no fields below the canvas.
6. **Journal.** "What you know" is a panel opened by a button and the J key, sliding over the scene.
7. **HUD.** Phase and round top left, the turn candle on the table, sound and the menu top right. Nothing else.
8. **Ending.** The masks turn over at the table, then the result, then Play again, Watch the replay, Share.
9. **Phone.** The same, full screen; the input bar sits above the keyboard and nothing covers Send.

The form stays, folded away, as the screen reader's path, and the flat pages stay as the fallback.

## Hidden information

Feel never leaks. A figure's idle behaviour, timing or sound must not differ
by role, by human or AI, or by anything this viewer may not know. Drive all
reactions from the view object only.

## Before finishing

- Play a full game yourself with `/playtest`.
- For each action you built, name its three beats in the PR.
- List any action still done through a form, and why.
