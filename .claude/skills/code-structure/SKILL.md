---
name: code-structure
description: Use while building a feature, when deciding where logic belongs, when two flows duplicate the same operation, or before adding a new helper. Encodes Round Table's architecture (pure engine, swappable players, prompts, logs, thin CLI) so generated code is easy to review.
---

# Code Structure

Round Table is a TypeScript (Node 22, ESM) game runner. The engine is pure and
replayable; everything with I/O sits at the edges. The spec is `docs/GAME.md`.

## Rules

1. **Search before writing.** Grep for an existing function that does the job.
   Extend or reuse it. Don't duplicate.
2. **Extract on the second use.** Don't extract on the first.
3. **Small diffs.** No unrelated refactors in a feature PR.
4. **Dependencies.** Only typescript, vitest and @types/node (dev). Ask before
   adding any other.

## Where things go

- `src/engine/` game state, phases and rules. Pure functions: given a seeded
  RNG and player responses, a game replays identically. No network, no file
  I/O, no `Date.now()` or `Math.random()`.
- `src/players/` one `Player` interface. The OpenRouter player and the mock
  player both implement it. The engine never knows which model it is talking
  to, and never imports a concrete player.
- `src/prompts/` builds each phase's prompt from game state. Pure.
- `src/log/` writes the JSON game log and renders a readable transcript.
- `src/cli/` entry points only (run a game, print a transcript). They
  orchestrate: load config, build players, call the engine, call the log. No
  game logic.
- `server/` the room server (a Node WebSocket server, dependency `ws`). It
  runs the same engine for a room of friends: `protocol.ts` (messages and
  every limit), `room.ts` and `registry.ts` (seats, codes, expiry),
  `seatPlayer.ts` (a person as a `Player`, with a turn timer), `game.ts`
  (runs one room's game), `session.ts` (one connection's messages),
  `guessing.ts` (the after-game guess in alias rooms), `saveLog.ts` (the saved
  log file), `address.ts` (where a connection came from), `server.ts` (the
  sockets). No game rules here: it calls the engine.
- `config/` cast (`cast.json`, OpenRouter model IDs) and game settings.
- `tests/` mirrors `src/` (`src/engine/x.ts` -> `tests/engine/x.test.ts`).

Dependency direction: `cli` -> `engine`, `players`, `prompts`, `log`.
`server` -> `engine`, `players`, `prompts`, `cast`; the web app talks to it
only through the messages in `server/protocol.ts` (it imports those types and
nothing else from `server/`), and `server/` never imports from `web/`.
`engine` may import shared *types* (such as `Player`) from the others, but
never an implementation (no mock, OpenRouter or replay player, no prompt
builder: the CLI injects those). `players` and
`prompts` and `log` never import `cli`.

## Hard rules

- **Parse and validate every model reply.** An invalid reply gets one retry.
  If the retry is also invalid, use a logged fallback action. Never crash a
  game on a bad reply, a timeout or an API error.
- **Public and private stay separate.** `speech` and `private_notes` are
  stored as separate fields. A player's `private_notes` are NEVER included in
  any other player's prompt. Prompt builders take only what that player may
  see, and a test asserts it.
- **Log everything.** The log records every prompt and every raw reply (and
  retries and fallbacks), so a game can be audited and replayed.
- **Secrets.** The API key comes from `OPENROUTER_API_KEY` at runtime. Never
  write it to a file, a log or a prompt. The command line masks it in the
  provider's reply (`players/scrub.ts`) and in the log before it is written.
  In a room, the host's key lives in
  the room's private field only, is scrubbed from every error text and from
  the finished log, and is dropped when the game ends or the room closes.
- **Rooms never send hidden information.** A client gets its own seat's
  prompt, the phase, and (after the game ends) the log. Never the roles,
  other people's notes or whispers, or who is acting.
- **Randomness is injected.** Engine code takes a seeded RNG; it never makes
  its own.

## Before finishing

- Logic sits in the right folder and nothing in `cli/` decides game rules.
- No duplicated logic you could have reused.
- Names say what the function does.
- New engine, prompt and log code has tests; players are tested with the mock.
- No private_notes leak into another player's prompt.
