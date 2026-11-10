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

## Work

All changes follow [AGENTS.md](AGENTS.md).
