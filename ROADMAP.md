# Roadmap

Unattended runs work through this file top to bottom, one PR per milestone.
The rules for those runs are in `AGENTS.md` under "Unattended runs".

Status: `[ ]` to do, `[x]` merged, `[!]` blocked (reason on the next line).
A milestone's PR ticks its own box.

**Goal:** everything needed to turn a real game into a Twitter clip, built and
tested on mock games. Real games are run by the owner, not by unattended runs.

## Milestones

- [x] **M1. Hardening from the PR #1 review.**
  - The system prompt takes the endgame threshold and "two remaining" rule
    from the engine's constants, not hardcoded text.
  - `/code-structure`: say the engine may import shared *types* (such as
    `Player`) but no implementations.
  - Reply parsing: when a reply has text around a single JSON object, extract
    the object, accept it, and record that it was extracted in the attempt.
    Real models often write a sentence before their JSON.
  - Done when: tests cover each change and all checks pass.

- [x] **M2. Batch runs and usage tracking.**
  - `npm run games -- --mock --seeds 1-20` runs many games and prints one
    summary line per game (winner, reason, rounds, fallbacks).
  - The OpenRouter player records the `usage` block of each response (tokens,
    and cost when OpenRouter returns it) on the attempt. This is an additive,
    optional field: update `docs/LOG.md`, keep `schemaVersion: 1`.
  - `--max-cost-usd <n>`: when the running total would pass `n`, the game
    stops cleanly and the log records why.
  - Tested with stubbed fetch only. Done when: tests and docs are updated.

- [x] **M3. Replay page v1.** A web app in `web/` that plays a game log like
  a TV episode.
  - Allowed dependencies: vite, react, react-dom, @vitejs/plugin-react,
    @types/react, @types/react-dom, @playwright/test.
  - Load a log from a file picker, or from `?log=<name>` for files in
    `web/public/games/`. Reject logs whose `schemaVersion` isn't 1 with a
    clear message.
  - Players sit around a table. Each turn shows phase headers, a speech
    bubble on the speaker, vote tallies, murders, banishments and role
    reveals, then a result screen.
  - A toggle shows or hides private notes, styled clearly as "hidden from
    players".
  - Keyboard: space plays or pauses, arrow keys step through turns.
  - Add `npm run web` (dev) and `npm run build:web` (static build), plus a
    Playwright smoke test that loads `tests/fixtures/sample-game.json` and
    steps through to the result.
  - Follow `/ui-design` and run `/design-review`.

- [x] **M4. Recording mode.** `?mode=record` is the clip camera.
  - No controls or chrome. Layouts for 16:9 and 9:16 (`&aspect=9x16`).
  - Autoplay paced by reading speed. `&from=<turnId>&to=<turnId>` plays only
    that range, so one URL is one clip.
  - "Two faces" view for a single turn: what the player said beside what
    they privately wrote. This is the shot the show is built on.
  - Playwright tests for both aspect ratios and a range. Run `/design-review`.

- [x] **M5. Highlight finder.** `npm run highlights -- <log>` lists the best
  moments, ranked, each with a recording-mode URL.
  - Deterministic rules, no model calls. At least: a traitor whispers to,
    defends or votes to save the player they targeted at night; a traitor
    votes against a fellow traitor; a recruit accepts; a faithful is
    banished by a majority; private notes that name a player the speech
    praises; the final reveal.
  - Output as text and JSON. Tests on fixture logs built for each rule.

- [x] **M6. Season stats (the Betrayal Index).** `npm run stats -- games/`
  aggregates logs per model: games, wins by role, times caught as a traitor,
  faithfuls banished with their vote, recruit offers accepted, and fallback
  rate. Output as JSON, plus a stats page in the web app. Tests on fixtures.

- [ ] **M7. Share cards.** `?card=<turnId>` renders a quote card ("said" vs
  "thought", player and model name, game and round) at 1200x675 and 1080x1350.
  `npm run card -- <log> <turnId>` saves PNGs to `.artifacts/cards/` with
  Playwright. Run `/design-review`.

- [ ] **M8. Guess the traitor.** `?mode=guess` turns any episode into a game
  for the viewer. This is what a Twitter post links to.
  - Roles and private notes stay hidden. After each round table the viewer
    picks who they think the traitors are; picks lock before the vote.
  - At the end: the reveal, a score, and the notes they were not shown for
    the moments they got wrong.
  - A spoiler-free result to copy (Wordle-style emoji row, episode number,
    link) and a share card image. No traitor names in either.
  - An episode index page listing logs in `web/public/games/`, and
    `?episode=today`, which picks one by date so everyone plays the same
    game that day.
  - Playwright tests. Run `/design-review`.

- [ ] **M9. Take a seat (solo).** One human plays against seven AIs in the
  browser.
  - A `HumanPlayer` implements the `Player` interface; the engine runs in the
    browser unchanged. The UI collects each phase's action and speech.
  - AI seats use the mock in tests. With real models, the user pastes their
    own OpenRouter key: kept in memory only, never stored, logged or sent
    anywhere but OpenRouter. Reuse the spend cap from M2.
  - End screen: "what the AIs really thought of you", the private notes
    that mention the human, plus a share card.
  - Human seats appear in the log with `model: "human"` (additive; update
    `docs/LOG.md`).

- [ ] **M10. Rooms: play with friends.** A room link friends open to play
  together, with AIs filling the empty seats.
  - `server/`: a Node WebSocket server. Allowed dependencies: ws, @types/ws.
    The engine runs on the server, so no client ever receives another
    player's role, whispers or notes. Add `server/` to `/code-structure`.
  - Create a room, share a code or link, 1 to 8 humans, start when ready.
    Turn timers with the engine's fallback on timeout; reconnect by seat.
  - The host supplies the OpenRouter key for the AI seats. It is held in
    memory for that room only and never logged or sent to clients. Spend cap
    per room.
  - Limits: message length, rate limit per connection, room expiry, all
    human text escaped. No accounts.
  - Tests drive several simulated clients through a full game with mock AIs
    and assert that no client received hidden information.
  - Run `/design-review` on the lobby and game screens.

- [ ] **M11. Human or AI?** The room mode built for sharing.
  - Optional mode: every seat gets an alias, so nobody knows which players
    are their friends and which are models.
  - End screen: who was human, who was a traitor, who fooled whom, and one
    extra guess each: "which seats were AI?".
  - A group result card ("3 of 4 humans trusted the AI traitor") and a
    spoiler-free share text with the room's replay link.
  - Room games save a normal log, so replay, highlights, cards and stats
    work on them.

- [ ] **M12. Launch readiness.**
  - `docs/EPISODE.md`: the owner's runbook, from real game to Twitter post:
    fill in `config/cast.json`, run games, find highlights, record a clip,
    make a card, publish the episode for guessing, post.
  - The README covers setup, every command, and the runbook.
  - `npm run build:web` produces a static site. Nothing is deployed.
  - `docs/DEPLOY.md`: how the owner hosts the static site and the room
    server, with the environment variables each needs. No vendor lock-in.
  - `docs/POSTING.md`: the post formats the tools support (clip, quote card,
    guess-the-traitor link, room invite, weekly Betrayal Index) with the
    command that produces each.
  - Done when the runbook works end to end on a mock game.

## Final version

The project is ready when every milestone above is `[x]`. What is left then
is the owner's: run real games, deploy, and post.
