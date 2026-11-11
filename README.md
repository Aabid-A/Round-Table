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

Spend cap, for real games: `--max-cost-usd <n>` on `game` or `games` stops a game
cleanly before a call that could pass `n` USD in total (spend so far plus the dearest
call yet). The log ends with `reason: "cost_cap"`. It needs OpenRouter to report a
cost; if none is reported the commands warn that the cap could not apply. Every
attempt records the response's `usage` (tokens, and cost when returned) in the log.

Each game writes `games/<name>.json` and prints its path. Print the readable
transcript (public speech with each player's hidden private notes beneath it):

```bash
npm run transcript -- games/mock-seed-1.json
```

The log format is in [docs/LOG.md](docs/LOG.md).

## Work

All changes follow [AGENTS.md](AGENTS.md).
