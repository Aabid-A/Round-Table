# Round Table

An AI social-deduction show. Eight LLMs (real models via OpenRouter) play a
Traitors-style game. Clips of the gap between each model's public speech and
its private notes get posted to Twitter.

The rules are in [docs/GAME.md](docs/GAME.md).

## Setup

Needs Node 22+.

```bash
npm ci
cp .env.example .env
```

Then put your OpenRouter key in `.env` as `OPENROUTER_API_KEY`. `.env` is
gitignored.

## Every command

| Command | What it does | More |
|---|---|---|
| `npm run game` | Play one game (`--mock` for no key, `--cast`, `--seed`, `--max-cost-usd`) | [Run a game](#run-a-game) |
| `npm run games` | Play many games, one summary line each (`--seeds 1-20`) | [Run a game](#run-a-game) |
| `npm run transcript` | Print a game as text: speech with the private notes under it | [Run a game](#run-a-game) |
| `npm run highlights` | Rank the best moments of a game, with a clip URL for each | [Highlights](#highlights) |
| `npm run card` | Save a quote card of one turn as PNGs | [Share cards](#share-cards) |
| `npm run episodes` | Write the episode list the guess page reads | [Guess the traitor](#guess-the-traitor) |
| `npm run stats` | Total a folder of logs per model (the Betrayal Index) | [Season stats](#season-stats-the-betrayal-index) |
| `npm run web` | The web app (replay, clips, cards, guess game, stats, solo, rooms) at port 5173 | [Replay page](#replay-page) |
| `npm run build:web` | Build the static site into `web/dist/` | [docs/DEPLOY.md](docs/DEPLOY.md) |
| `npm run rooms` | The room server (port 8787) for play with friends | [Rooms](#play-with-friends-rooms), [docs/ROOMS.md](docs/ROOMS.md) |
| `npm run typecheck` | Type-check the server code and the web app | |
| `npm test` | Unit tests | |
| `npm run test:e2e` | Browser tests (a page on port 5183 and a room server on 8788) | |

## From a game to a post

[docs/EPISODE.md](docs/EPISODE.md) is the runbook: set up the cast, run games, read them, find the best moments, record a
clip, make a card, publish an episode for guessing, and post, with a rehearsal on a mock game that needs no key.
[docs/POSTING.md](docs/POSTING.md) lists the post formats and the command that makes each, and
[docs/DEPLOY.md](docs/DEPLOY.md) says how to host the static site and the room server. Nothing is deployed for you.

## Run a game

Mock game, no network, no key needed:

```bash
npm run game -- --mock --seed 1
```

Real game with real models:

```bash
cp config/cast.example.json config/cast.json
npm run game -- --cast config/cast.json
```

`config/cast.example.json` holds placeholder model IDs. Fill in real IDs from
[openrouter.ai/models](https://openrouter.ai/models) before running. `config/cast.json`
is gitignored.

Many games at once, one summary line per game (seed, winner, reason, rounds,
fallbacks, log path). Seeds can be `1-20`, `7` or `1,5,9-12`:

```bash
npm run games -- --mock --seeds 1-20
```

Spend cap, for real games: `--max-cost-usd <n>` on `game` or `games` stops each game
cleanly before a call that could pass `n` USD (spend so far plus the dearest call
yet). It is per game, not per batch, and a prediction: the first call, or a call dearer
than any before it, can overshoot. The log ends with `reason: "cost_cap"`. A call to a real model that comes
back with no usable cost (it timed out, failed, or reported none) still counts, as an estimate: the largest
cost seen so far in that game, or 0.01 dollars if none yet (`--cost-floor-usd <n>` changes that, and needs
`--max-cost-usd`). The attempt is marked `costEstimatedUsd` in the log and the command says how many calls were
estimated. Mock and human players are free, so a mock game under a cap has nothing to count.
Separately, every game has a hard limit on calls to players, worked out from the seats and the rounds (696 for
the default game, which a normal game never gets near), whatever the calls cost; a game that hits it ends with
`reason: "call_limit"` ([docs/LOG.md](docs/LOG.md#the-limit-on-calls)). Every attempt
records the response's `usage` (tokens, and cost when returned) in the log.

Each game writes `games/<name>.json` and prints its path. Print the readable
transcript (public speech with each player's hidden private notes beneath it):

```bash
npm run transcript -- games/mock-seed-1.json
```

The log format is in [docs/LOG.md](docs/LOG.md).

## Replay page

A web app in `web/` that plays a game log like an episode: players around a table, a
speech bubble on the speaker, vote tallies, murders, banishments and role reveals, then a
result screen. A switch shows or hides each player's private notes (marked "hidden from
players"). Space plays or pauses; the arrow keys step.

```bash
npm run web
```

Open the address it prints, then choose a log file, or copy a log into
`web/public/games/` (its `.json` files are gitignored) and open `?log=<name>`:

```bash
cp games/mock-seed-1.json web/public/games/
# then open http://localhost:5173/?log=mock-seed-1
```

Logs with a `schemaVersion` other than 1 are rejected with a message. `npm run build:web`
writes a static site to `web/dist/`; nothing is deployed.

### Sitting in a seat

Choose a seat under "Sit in a seat" (or open `?log=<name>&seat=<player>`) and the replay moves into
a 3D room, with the camera in that player's chair. The view is built from what that player's own
prompts told them, plus the events the log says they could see: a faithful never sees who the
living traitors are, and nobody sees another player's private notes or whispers they were not part of.
A traitor sees their fellow traitor. Switching seats, or going back to the public table, keeps the same
moment. The room is plain CSS 3D (no dependency); with `prefers-reduced-motion` it does not animate,
and the 2D table is still the public view.

### Recording mode (the clip camera)

`?mode=record` shows the episode with no controls or chrome, in a fixed shape, and plays by
itself at reading speed. One URL is one clip. It needs a log in `web/public/games/`:

```text
http://localhost:5173/?mode=record&log=mock-seed-1                       whole episode, 16:9
http://localhost:5173/?mode=record&log=mock-seed-1&aspect=9x16           vertical, 9:16
http://localhost:5173/?mode=record&log=mock-seed-1&from=10&to=14         turns 10 to 14 only
http://localhost:5173/?mode=record&log=mock-seed-1&faces=14              "two faces" for turn 14
http://localhost:5173/?mode=record&log=mock-seed-1&from=10&to=14&speed=2 twice as fast
```

- `aspect` is `16x9` (default) or `9x16`. The stage keeps that shape at any window size.
- `from` and `to` are turn ids (inclusive). The result screen is included only if the clip
  reaches the last turn. Turn ids are the `id` field in the log (see [docs/LOG.md](docs/LOG.md)).
- `faces=<turn>` is the shot the show is built on: what the player said beside what they
  privately wrote, marked hidden from players.
- `speed` divides the pacing (0.05 to 100). A bad value is shown as plain text.
- `seat=<name>` films the game from that player's chair, and `seats=<a>,<b>` is a split view
  of two seats at the same moment (side by side in 16:9, one above the other in 9:16). A seat
  shows only what that player was told; see "Sitting in a seat" below.
- When a clip finishes it holds the last frame and sets `data-done="true"` on the `.rec`
  element, so a screen recorder or script knows when to stop.

### Highlights

`npm run highlights -- games/mock-seed-1.json` lists the best moments of a game, ranked,
each with a recording-mode URL (and a two-faces URL where the moment is speech against
private notes). `--json` prints JSON. Rules and options: [docs/HIGHLIGHTS.md](docs/HIGHLIGHTS.md).

### Season stats (the Betrayal Index)

`npm run stats -- games/` totals a folder of game logs per model: games, wins by role, times
caught as a traitor, faithfuls voted out by its traitor vote, recruit offers accepted and the
fallback rate, plus a betrayal index. It prints JSON; add `--out web/public/stats.json` and
open `?page=stats` on the replay page for a sortable table. Definitions:
[docs/STATS.md](docs/STATS.md).

### Share cards

A quote card shows one turn: the player and model, the game and round, what they said beside
what they thought (marked hidden from the other players). Two shapes: 1200x675 and 1080x1350.

```text
http://localhost:5173/?card=14&log=mock-seed-1                     1200x675
http://localhost:5173/?card=14&log=mock-seed-1&size=1080x1350      1080x1350
```

`card` is a turn id from the log (the `id` field; `npm run highlights` gives good ones, as the
`facesTurn`). To save PNGs, no server needed:

```bash
npm run card -- games/mock-seed-1.json 14
```

It writes `.artifacts/cards/mock-seed-1-turn-14-1200x675.png` and `...-1080x1350.png` with
Playwright (`--size 1200x675|1080x1350|both`, `--out <folder>`, `--name <name>`). A quote longer
than about 360 characters (wide) or 560 (tall) is cut at a word with an ellipsis; the replay page
has the full text. On your own machine run `npx playwright install chromium` once first.

### Guess the traitor

`?mode=guess` turns an episode into a game for the viewer. This is what a post links to. They watch
the public part (round table speeches, votes, breakfast, banishments). After each round table they
pick who they think the traitors are, and the picks lock before the vote. The traitors' night,
whispers, recruitment, roles and private notes stay hidden until the end. At the end: the score, the
reveal, what the traitors they missed said and privately wrote, a result to copy and a card to
download. The result and the card name no one:

```text
Round Table #4 🟩🟨⬛ 3/5
http://localhost:5173/?mode=guess&log=episode-004&episode=4
```

Green means every traitor found that round, yellow some, black none. How many to pick is the number
of traitors the game started with, minus the ones caught so far. A recruitment makes the true number
higher and the viewer is not told, so a round is scored out of what they were asked to pick. An episode
with no vote has nothing to guess and says so.

To offer episodes, copy logs into `web/public/games/` and write the list:

```bash
cp games/mock-seed-1.json web/public/games/episode-001.json
npm run episodes -- web/public/games
```

`npm run episodes` writes `web/public/games/index.json`: numbered episodes in file name order, with
no winners or roles. Name files so they sort in release order and **zero-pad** the number
(`episode-010` after `episode-009`; plain `episode-10` sorts before `episode-2`). Adding a file in the
middle renumbers the ones after it and breaks old `?episode=N` links and shared "#N" results, so only
add to the end. Pick neutral file names: a shared link carries `log=<name>`, so `traitors-win` would
give it away. The page downloads the whole log to the browser (that is how it plays), so a determined
viewer can read the roles in the network tab; this is a game, not a vault. Then:

```text
http://localhost:5173/?page=episodes                      the list
http://localhost:5173/?mode=guess&episode=today           today's episode, the same for everyone
http://localhost:5173/?mode=guess&episode=3               episode 3
http://localhost:5173/?mode=guess&log=episode-003         a log by name
```

Today's episode is picked by the UTC date and cycles through the list, so everyone plays the same
game that day. `&date=2026-11-11` previews another day.

### Take a seat (solo)

`?mode=play` puts you at the table against seven AIs, in your browser tab. The engine, prompts and AI
players are the same code the command line uses; your turns arrive as forms (what you know, the task,
and the choices for that phase), and you can add a private note for viewers on each turn.

```text
http://localhost:5173/?mode=play
http://localhost:5173/?mode=play&seed=42     the same game again (same seats and roles)
```

- **Practice AIs** need no key and send nothing anywhere.
- **Real models** need your own OpenRouter key and seven model IDs (see openrouter.ai/models; I do not
  ship any), plus a **spend cap** in US dollars: the game stops before a call that could pass it, as with
  `--max-cost-usd`. The key lives in this tab's memory only: it is cleared from the page when the game
  starts, sent only to OpenRouter, never stored (no local or session storage, no cookies) and not put in
  the log. Closing or reloading the tab forgets it. Costs are only known if OpenRouter reports them.
- At the end you see who was who and **what the AIs really thought of you**: every private note that
  names you, with what they said, and a card for each (1200x675 PNG). Long lists show the first six.
  You can also download the whole game log; your seat has `model: "human"` in it
  ([docs/LOG.md](docs/LOG.md)), so replay, highlights, cards and stats work on it.

### Play with friends (rooms)

`npm run rooms` starts a small WebSocket server (port 8787) that runs a game for up to eight people, with
AIs in the empty seats. One person makes a room and shares the code or invite link; the others open it,
pick a name and take a seat; the host starts. Open `http://localhost:5173/?mode=room` (after `npm run web`).

```text
http://localhost:5173/?mode=room                     make a room, or join with a code
http://localhost:5173/?mode=room&room=AB2CD          the invite link: join room AB2CD
```

Turns have a clock (a missed turn gets the engine's fallback), reloading takes your seat back, and nobody
is ever sent another person's role, notes or whispers before the game ends. For real models the host's
OpenRouter key is held in memory for that room only and never logged or sent to anyone. Settings, limits
and the key rules: [docs/ROOMS.md](docs/ROOMS.md).

Tick **Human or AI?** when making a room and everyone plays under an alias, so nobody knows which seats are friends and which
are models. At the end each person guesses which seats were AIs before the reveal, and the end screen shows who fooled whom, a
result card ("3 of 4 humans trusted the AI traitor") and a spoiler-free line to share with the replay link. Every finished game
is saved as a normal log in `games/` (`LOG_DIR` changes the folder), so replay, highlights, cards and stats work on it.

Browser tests: `npm run test:e2e` (Playwright, page on port 5183 and a room server on 8788). On your own machine run
`npx playwright install chromium` once first.

## Work

All changes follow [AGENTS.md](AGENTS.md).
