---
name: playtest
description: Use after building or changing the game world or how the game plays, before shipping. Plays a real game in a browser, records it, and judges the result by looking at it against the art direction. Complements design-review, which covers flat UI.
---

# Playtest

Tests prove the game works. This proves it looks and feels like a game. Judge
by watching, not by reading code.

## Steps

1. **Run it for real.** `npm run build:web`, serve it, and open the mode you
   changed in Chromium with WebGL on. Use a mock game with a fixed seed.
2. **Play a whole game** through the changed mode with Playwright driving
   real pointer and keyboard input: look around, select, vote, whisper, sit
   through a night, a murder, a banishment and the ending.
3. **Record** into `.artifacts/<task>/playtest/`:
   - one video of the full run, and a 20 to 40 second cut of the best part;
   - stills of every staged moment in `/art-direction`, at 1280x720 and
     390x844;
   - frame rate and frame-time spikes, saying whether the run was headless
     software rendering.
4. **Look at every still** and answer, in `playtest.md`:
   - Would a stranger call this a 3D game or a web page?
   - Is most of the frame dark, with light leading the eye?
   - Can every player be told apart at a glance, without reading names?
   - Does anything read as a flat card, a default material or evenly lit?
   - Is any text unreadable, clipped or floating free of its speaker?
   - Did every action have anticipation, response and settle?
   - Was any figure frozen? Did the camera ever snap or drift aimlessly?
5. **Check the fail list** in `/art-direction`. Any hit is a blocker.
6. **Fix blockers, re-record, repeat.** Cap at 3 rounds.
7. **Get a second opinion.** Give the stills (not the code) to a context that
   did not build them, with `/art-direction`, and ask for the three weakest
   frames and why. Fix or answer each.
8. **Put in the PR:** the short video, six stills, the answers above, what
   was fixed, and what still falls short.

## Owner gate

Look and feel are the owner's call. A PR that changes the world's look is
never auto-merged: commit the stills and short video under
`docs/playtests/<task>/`, label the PR `needs-human`, and stop for approval.

## Honesty

- If WebGL would not run in your environment, say so and do not approve what
  you have not seen.
- Say plainly where it still looks flat or cheap. "Meets the frame-rate bar"
  is not a verdict on the look.
