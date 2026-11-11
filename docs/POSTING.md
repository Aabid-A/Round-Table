# Post formats

What the tools can make for a post, and the command that makes each. The steps from a game to these are in
[EPISODE.md](EPISODE.md). Links in a post must point at your published site ([DEPLOY.md](DEPLOY.md)), not `localhost`.

| Format | What you get | Reveals |
|---|---|---|
| [Clip](#clip) | A short video of one moment, 16:9 or vertical | The moment's speech and, in "two faces", a private note |
| [Quote card](#quote-card) | One turn as a picture: what they said, beside what they thought | That turn only |
| [Guess-the-traitor link](#guess-the-traitor-link) | A game the viewer plays | Nothing until the viewer finishes |
| [Room invite](#room-invite) | A link friends open to play together | Nothing (the game has not been played) |
| [Human or AI? result](#human-or-ai-result) | A result card and a share text from a room game | The card does; the text does not |
| [Weekly Betrayal Index](#weekly-betrayal-index) | A table of how each model played | Per-model totals |

## Clip

A recording of one moment, made from a log.

```bash
npm run highlights -- games/<name>.json --limit 5
```

Each moment has a recording URL (`from` and `to` are turn ids). Add `--aspect 9x16` for vertical URLs, or
`--base https://your-site/` to print URLs for your site. Copy the log to `web/public/games/`, run `npm run web`, open
the URL and record the browser window with a screen recorder. The page plays by itself and sets `data-done="true"` on
the `.rec` element when it ends.

```text
http://localhost:5173/?mode=record&log=<name>&from=10&to=14                16:9
http://localhost:5173/?mode=record&log=<name>&from=10&to=14&aspect=9x16    vertical
http://localhost:5173/?mode=record&log=<name>&faces=14                     "two faces" for turn 14
```

The "two faces" shot is the one the show is built on: what a player said, beside what they privately wrote, marked
hidden from the other players. It is offered where a moment is speech against private notes.

## Quote card

```bash
npm run card -- games/<name>.json <turn id>
```

Two PNGs in `.artifacts/cards/`: 1200x675 (a wide card for a timeline) and 1080x1350 (tall). A quote longer than about
360 characters (wide) or 560 (tall) is cut at a word with an ellipsis; the replay page has the full text. A `facesTurn`
from `npm run highlights -- <log> --json` is a good turn to use.

## Guess-the-traitor link

The post links to a game the viewer plays: they watch the public part, pick the traitors after each round table, and
get a score at the end. Roles and private notes stay hidden until then.

```bash
cp games/<name>.json web/public/games/episode-001.json
npm run episodes -- web/public/games
npm run build:web
```

Then link to one of these on your published site:

```text
https://your-site/?mode=guess&episode=today     today's episode, the same for everyone (picked by the UTC date)
https://your-site/?mode=guess&episode=3         episode 3
https://your-site/?page=episodes                the list
```

When the viewer finishes, the page gives them a result to copy, such as `Round Table #4 🟩🟨⬛ 3/5` and a link, and a card
to download. Neither names a traitor. Episode file names and numbers: see step 8 of [EPISODE.md](EPISODE.md) (neutral names,
zero-padded, add only to the end).

## Room invite

An invite to play together, with AIs in the empty seats. Start the room server and the page, make a room, and share the
invite link from the lobby:

```bash
npm run rooms
```

```text
https://your-site/?mode=room&room=AB2CD
```

The page needs to know where the room server is: set `VITE_ROOM_SERVER` when you build it ([DEPLOY.md](DEPLOY.md)).
Settings and limits: [ROOMS.md](ROOMS.md).

## Human or AI? result

Tick **Human or AI?** when making the room. At the end each person guesses which seats were AIs, and the end screen
gives two things to post:

- **A result card** (1200x675 PNG): the headline is how many people trusted the traitor ("3 of 4 humans trusted the AI
  traitor"), with who was at the table, the average guess and who fooled the most. Press **Download the result card**.
  This one gives the game away, so post it after people have played.
- **A share text**, with the replay link, that does not spoil anything: how many people and AIs were at the table, how
  that person did at guessing, and the link. Press **Copy the text**.

The replay link opens the room's saved log, `?log=room-<code>-seed-<seed>`, and works once that file is in
`web/public/games/` (the server saves it in `LOG_DIR`, default `games/`; copy it across, or point `LOG_DIR` there).

## Weekly Betrayal Index

```bash
npm run stats -- games --out web/public/stats.json
```

Totals every log in the folder per model: games, wins as a traitor and as a faithful, times caught, faithfuls voted out by
its traitor vote, recruit offers accepted, the fallback rate, and the betrayal index. Open `?page=stats` for the sortable
table. There is no image export: post a screenshot of the table (or the JSON). The numbers are noisy until each model has
played a few dozen games. Definitions: [STATS.md](STATS.md).

## Also from the solo page

At the end of `?mode=play`, "What the AIs really thought of you" lists every private note that names you, with a 1200x675
card for each (**Download card**). It is a good post for whoever played, and it only exists in that person's browser.
