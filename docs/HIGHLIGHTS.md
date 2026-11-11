# Highlights

`npm run highlights -- <log>` lists the best moments of a game, ranked, each with a
recording-mode URL for the replay page (see the README). It reads a game log
([LOG.md](LOG.md)) and uses fixed rules. No model is called, so the same log always gives
the same list.

```bash
npm run highlights -- games/mock-seed-1.json
npm run highlights -- games/mock-seed-1.json --json --limit 5 --aspect 9x16
```

Options: `--json` (JSON instead of text), `--limit N` (keep the best N), `--base URL`
(where the replay page is served; default `http://localhost:5173/`), `--name NAME` (the
log's name in `web/public/games/`; default is the file name without `.json`),
`--aspect 16x9|9x16` (added to the URLs).

Copy the log into `web/public/games/` first, so the URLs open:
`cp games/mock-seed-1.json web/public/games/`.

## Output

Text: one block per highlight.

```text
#1  [90]  Dax accepts Bram's offer and becomes a traitor
    round 1, turns 40 to 41  (recruit_accepted)
    clip:      http://localhost:5173/?mode=record&log=mock-seed-1&from=40&to=41
    two faces: http://localhost:5173/?mode=record&log=mock-seed-1&faces=41
```

JSON: an array of objects, best first.

| Field | Type | Meaning |
|---|---|---|
| `rank` | integer | 1 is best. |
| `score` | integer 0 to 100 | How strong the moment is. |
| `rule` | string | Which rule found it (below). |
| `title` | string | One line a person can read. |
| `round` | integer | Round of the moment. |
| `from`, `to` | integer | Turn ids of the clip, inclusive. |
| `facesTurn` | integer or null | A turn that suits the "two faces" shot. |
| `url` | string | Recording URL for the clip. |
| `facesUrl` | string or null | Recording URL for the two-faces shot. |

Ties on score go to the earlier moment.

## Rules

"Night target" means a player a traitor proposed to murder in a night up to that round,
who was not the one murdered and is still in the game. A recruit counts as a traitor from
the turn after they accept.

| Rule | Score | Finds |
|---|---|---|
| `recruit_accepted` | 90 | A faithful accepts a recruitment offer. Clip: the offer to the answer. |
| `saves_night_target_in_revote` | 88 | In a revote a traitor votes for the other tied player, saving a night target. |
| `whispers_to_night_target` | 85 | A traitor whispers to a night target. |
| `notes_contradict_praise` | 85, or 75 | A player's speech praises someone and the same turn's private notes name them (85 when the notes scheme against them: target, frame, lie and similar words). |
| `traitor_votes_traitor` | 80 | A traitor votes against a fellow traitor, in the vote or the revote. |
| `defends_night_target` | 70 | At the round table a traitor accuses someone who is accusing their night target. |
| `faithful_banished_by_majority` | 55 to 85 | A faithful is banished by a majority; more of the votes scores higher. |
| `final_reveal` | 50 | The last turns and the result. Always present. |

`notes_contradict_praise` reads the words of the speech and notes with simple word lists
(see `src/log/highlights/rules.ts`). It finds a name only as a whole word.
