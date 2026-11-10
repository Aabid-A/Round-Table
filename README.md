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

Each game writes `games/<name>.json` and prints its path. Print the readable
transcript (public speech with each player's hidden private notes beneath it):

```bash
npm run transcript -- games/mock-seed-1.json
```

The log format is in [docs/LOG.md](docs/LOG.md).

## Work

All changes follow [AGENTS.md](AGENTS.md).
