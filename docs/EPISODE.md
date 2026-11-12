# Episode runbook

From a real game to a post. The steps from "run games" onward were run end to end on a mock game, so you can rehearse them
first with no key and no cost (see [Rehearse](#rehearse-on-a-mock-game)). What a mock game cannot rehearse is your real
cast, your key and the spend cap: expect a typo in `config/cast.json` or a wrong model ID to show up on your first real run,
as a high `fallbacks` number (step 3).
The post formats are in [POSTING.md](POSTING.md); hosting is in [DEPLOY.md](DEPLOY.md).

## 1. One-time setup

Needs Node 22+.

```bash
npm ci
cp .env.example .env
```

Put your OpenRouter key in `.env` as `OPENROUTER_API_KEY=...`. `.env` is gitignored. The key is read at run time,
and this project never writes it to a file or puts it in a prompt. A provider can echo a key back inside an error message,
and the engine logs error text, so check your logs before you publish them (see [Before you post](#before-you-post)).
For the card images, install the browser once:

```bash
npx playwright install chromium
```

## 2. Fill in the cast

```bash
cp config/cast.example.json config/cast.json
```

Open `config/cast.json` and replace each `REPLACE-WITH-OPENROUTER-MODEL-ID-n` with a real model ID from
[openrouter.ai/models](https://openrouter.ai/models). There are eight seats; names must be unique. A cast that
still has a placeholder is refused with a message naming the seat. `config/cast.json` is gitignored. The game
settings (rounds, number of traitors) are in `config/game.json`.

## 3. Run games

One game, with a spend cap so a bad run cannot cost more than you meant:

```bash
npm run game -- --cast config/cast.json --max-cost-usd 2
```

Or several, one summary line each (seed, winner, reason, rounds, fallbacks, log path):

```bash
npm run games -- --cast config/cast.json --seeds 1-5 --max-cost-usd 2
```

Each game writes `games/<name>.json` and prints its path. **Look at the `fallbacks` number.** A fallback means a
model gave no valid reply and the engine moved for it. A few are normal; most turns being fallbacks means the key
or a model ID is wrong, and the game is not worth posting. The cap is per game and works only if OpenRouter reports
costs; if it cannot apply, the command says so.

## 4. Read the game

```bash
npm run transcript -- games/<name>.json
```

Public speech, with each player's hidden private notes under it. Read it before you post anything: **the log holds
every private note**, and the guess page and the replay page can show them. Decide what you are happy to publish.

## 5. Find the moments

```bash
npm run highlights -- games/<name>.json --limit 5
```

A ranked list of the best moments, each with a recording URL and, where a player said one thing and wrote another, a
"two faces" URL (`facesUrl`, and `facesTurn`, a turn id you can use for a card). `--json` prints JSON;
`--aspect 9x16` makes the URLs vertical; `--base <address>` prints URLs for your published site instead of
`localhost` (the default). Rules: [HIGHLIGHTS.md](HIGHLIGHTS.md).

The URLs name the log by its file name, and the page reads it from `web/public/games/`, so copy it there first:

```bash
cp games/<name>.json web/public/games/
```

## 6. Record a clip

```bash
npm run web
```

Open a clip URL from step 5, for example:

```text
http://localhost:5173/?mode=record&log=<name>&from=66&to=68
http://localhost:5173/?mode=record&log=<name>&from=66&to=68&aspect=9x16
```

The page shows the episode with no controls, in a fixed 16:9 or 9:16 shape, and plays by itself at reading speed
(`&speed=2` for twice as fast). Record the browser window with any screen recorder. When the clip ends it holds the last
frame and sets `data-done="true"` on the `.rec` element, so you know when to stop (a script can wait for
`.rec[data-done="true"]`). Options: [README](../README.md#recording-mode-the-clip-camera).

## 7. Make a card

```bash
npm run card -- games/<name>.json <turn id>
```

Saves a quote card of one turn as two PNGs, 1200x675 and 1080x1350, in `.artifacts/cards/` (what the player said,
beside what they privately thought). Use a `facesTurn` from step 5 for the best ones. `--size`, `--out` and `--name`
change the shape, folder and file name.

The card is drawn in a headless Chromium. If `npx playwright install chromium` is not an option, set `CHROMIUM_PATH` to a
Chromium binary you already have.

## 8. Publish the episode for guessing

The guess page (`?mode=guess`) turns an episode into a game for the viewer. This is what a post links to.

```bash
cp games/<name>.json web/public/games/episode-001.json
npm run episodes -- web/public/games
```

- Name files so they **sort in release order** and **zero-pad** the number (`episode-010` after `episode-009`).
- Only add to the end: adding in the middle renumbers the ones after it and breaks old `?episode=N` links.
- Use **neutral file names**: a link carries `log=<name>`, so `traitors-win` would give the game away.
- Every `.json` in `web/public/games/` is published when you build the site, **private notes included**. Keep only logs
  you mean to publish there.

Then build the static site and put it online ([DEPLOY.md](DEPLOY.md)):

```bash
npm run build:web
```

Check it first with `npm run web` and open `http://localhost:5173/?page=episodes`.

## 9. Post

Pick a format from [POSTING.md](POSTING.md): a clip, a quote card, a guess-the-traitor link, a room invite, or the weekly
Betrayal Index.

## 10. Weekly: the Betrayal Index

```bash
npm run stats -- games --out web/public/stats.json
```

**Keep room games out of this total.** The room server saves finished room games in `games/` too (`LOG_DIR`), and a game
with a person in it adds a `human` row to the table, which is not a model ([STATS.md](STATS.md)). Run real model games into
their own folder (`--out games/real`, then `npm run stats -- games/real ...`), or point the room server's `LOG_DIR`
somewhere else.

Totals every log in the folder per model (games, wins by role, times caught, betrayals, fallback rate, and the index).
Open `?page=stats` for the table. Definitions: [STATS.md](STATS.md). The numbers are noisy until each model has played a
few dozen games.

## Rehearse on a mock game

The same steps with no key and no cost. All of these were run for this document:

```bash
npm run games -- --mock --seeds 1-3
npm run transcript -- games/mock-seed-1.json
npm run highlights -- games/mock-seed-1.json --limit 3
npm run card -- games/mock-seed-1.json 14
```

```bash
cp games/mock-seed-1.json web/public/games/episode-001.json
cp games/mock-seed-2.json web/public/games/episode-002.json
cp games/mock-seed-3.json web/public/games/episode-003.json
npm run episodes -- web/public/games
npm run stats -- games --out web/public/stats.json
npm run build:web
```

The built `web/dist/` then works from any folder on a static host (checked from `/shows/round-table/`): the episode list,
`?mode=guess&episode=1`, `?page=stats`, `?log=<name>` and a recording-mode clip that reaches `data-done="true"`, with
no errors in the browser console. Delete the mock logs from `web/public/games/` before building the real site.

Two automated checks keep this honest. `tests/runbook.test.ts` runs the command-line half on every `npm test` and checks
that every `npm run` command and link in these docs exists. `web/e2e/static-site.e2e.ts` (in `npm run test:e2e`) builds the
site, adds mock episodes and stats, hosts it from a folder on a plain static server and opens each kind of page.

## Before you post

- [ ] The game had few fallbacks.
- [ ] You read the transcript and are happy with every private note that a published log will show.
- [ ] `web/public/games/` holds only logs you mean to publish (and no mock logs).
- [ ] The links in the post open on the published site, not `localhost`.
- [ ] No key in anything you publish. This prints nothing when it is clean (it loads `.env` the way the commands do, matches the
  key as plain text, and looks in the logs, `web/public` and the built site):

  ```bash
  set -a; . ./.env; set +a
  if [ -z "$OPENROUTER_API_KEY" ]; then echo "OPENROUTER_API_KEY is not set: nothing to check"; else grep -rlF -- "$OPENROUTER_API_KEY" games web/public web/dist 2>/dev/null; fi
  ```

  `git status` should also show no `.env`.
