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
than any before it, can overshoot. The log ends with `reason: "cost_cap"`. It needs OpenRouter to report a
cost; if none is reported the commands warn that the cap could not apply. Every
attempt records the response's `usage` (tokens, and cost when returned) in the log.

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
- `speed` divides the pacing (0 to 100). A bad value is shown as plain text.
- When a clip finishes it holds the last frame and sets `data-done="true"` on the `.rec`
  element, so a screen recorder or script knows when to stop.

Browser tests: `npm run test:e2e` (Playwright, port 5183). On your own machine run
`npx playwright install chromium` once first.

## Work

All changes follow [AGENTS.md](AGENTS.md).
