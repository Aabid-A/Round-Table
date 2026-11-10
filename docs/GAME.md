# Round Table: game spec

Future tasks build against this file. Architecture lives in
`.claude/skills/code-structure/SKILL.md`.

## Setup

- 8 players, each a real LLM. 2 are secret **traitors**, 6 are **faithfuls**.
- Traitors know each other. Faithfuls know only their own role.
- The game ends within about 5 rounds.

## Round order

1. **Night.** The traitors privately agree on one faithful to murder.
2. **Breakfast.** The victim is revealed (their role too).
3. **Whispers.** Each player may send one private message to one player.
4. **Round table.** Every player MUST name one suspect and give a reason.
5. **Banishment vote.** Each player votes. The player with the most votes is
   banished and their role is revealed. Ties are broken by a revote between
   the tied players, then at random (seeded RNG).

## Recruitment

When a traitor is banished and traitors remain, a surviving traitor may offer
one faithful the chance to become a traitor. The faithful accepts or refuses.

## Endgame

When 4 or fewer players remain, the survivors vote to end the game or banish
again. At the end, if any traitor survives, the traitors win. Otherwise the
faithfuls win.

## Player turns

Every player turn returns:

```json
{ "speech": "...", "private_notes": "...", "action": { } }
```

- `speech`: what the player says publicly (empty if the phase has none).
- `private_notes`: the player's stated strategy for that turn. Shown only to
  viewers. Never given to any player, including the author on later turns
  unless a task explicitly decides otherwise.
- `action`: the phase's decision (murder target, whisper, suspect and reason,
  vote, recruit offer or answer, end-or-banish vote).

Replies are parsed and validated. An invalid reply gets one retry, then a
logged fallback.

## Cast

Real models by name. `config/cast.json` lists the OpenRouter model IDs. There
are no persona prompts: each model plays as itself.

## Output

- One JSON log per game in `games/` (gitignored). It records every prompt and
  raw reply, with speech and private_notes stored separately.
- A plain-text transcript that shows speech and private notes side by side.
