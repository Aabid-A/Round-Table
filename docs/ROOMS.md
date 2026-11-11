# Rooms: play with friends

A room lets up to eight people play one game together, with AIs in the empty seats. A small Node
server runs the game; each person uses the web page. There are no accounts.

## Run it

```bash
npm run rooms
```

That starts the room server on port 8787. In another terminal run `npm run web` and open
`http://localhost:5173/?mode=room`.

| Variable | Where | Meaning |
|---|---|---|
| `PORT` | server | Port to listen on. Default 8787. |
| `HOST` | server | Address to bind. Default: all addresses. |
| `TURN_MS` | server | How long a person has for one turn. Default 90000 (90 seconds). |
| `ABANDON_MS` | server | How long a running game may have nobody connected before its room closes. Default 120000. |
| `ALLOW_SEED` | server | Set to `1` to let a page choose a room's seed with `?seed=N`. For tests and replays only: the seed decides every role, so anyone who can pick it can work the roles out with the public engine code. Off by default; the server then picks a random seed and ignores the page's. |
| `MAX_ROOMS_PER_ADDRESS` | server | Open rooms one network address may have. Default 3 (finished rooms do not count). |
| `MAX_CONNECTIONS_PER_ADDRESS` | server | Connections one network address may hold. Default 20. |
| `TRUST_PROXY` | server | Set to `1` only behind exactly one reverse proxy that you run: the address is then the last `X-Forwarded-For` entry, the one your proxy added (earlier entries are whatever the client sent). Without it, every client behind the proxy looks like one address and shares these limits. |
| `LOG_DIR` | server | Folder where each finished game's log is saved. Default `games/`; `LOG_DIR=none` turns saving off. See "Saved logs". |
| `VITE_ROOM_SERVER` | web page, when it is served or built | The room server's address, such as `wss://rooms.example.org`. Default: port 8787 on the page's own host. |

Time values are whole milliseconds from 100 to 86400000. A bad value stops the server and names the
variable. The page never takes the server address from the page URL, so a link cannot send a host's key
to another server.

## Play

1. The host opens `?mode=room`, picks a name and who fills the empty seats, and makes a room.
2. The host shares the five-letter code or the invite link (`?mode=room&room=CODE`).
3. Friends open the link, pick a name and join. The lobby shows who is there and who is offline.
4. The host starts the game. The seats are filled with AIs: eight seats, minus the people.
5. On your turn you get the same form as solo play, and a clock. If the clock runs out, the engine's
   fallback move is made for you, as it is for a model that times out, and a note tells you.
6. At the end everyone sees who won, who was who, and can download the log. It is a normal game log
   ([LOG.md](LOG.md)), with `model: "human"` on each person's seat.

Reloading the page takes your seat back (the room code and a seat token are kept in the tab's session
storage). A dropped connection reconnects on its own. `&seed=N` on the making page fixes the game, but only on a server started with `ALLOW_SEED=1`; otherwise it is ignored.

## Human or AI?

Tick **Human or AI?** when making a room and nobody knows which seats are friends and which are AIs.

- Every seat, people and AIs, plays under one of the eight AI names (Aria, Bram, Cleo...), in the same table order. A
  person's real name appears in no prompt and on no other page while the game runs. Each person is told only their own
  alias, when the game starts. Prompts, speeches and the log use the aliases. (A person can still give themselves away by what
  they type, and AI calls and people take different amounts of time.)
- When the game ends, **before** anyone is told who was who, each person ticks the seats they think were AIs (not their own).
  The room waits for everyone still connected, up to 60 seconds; a person who left or was too slow is not scored.
- Then the finished log and the outcome are sent: who was behind each alias, who was a traitor, each person's score
  (right calls out of the other seven seats), and for each seat the people who got it wrong ("who fooled whom").
- The end screen has a **result card** (a 1200x675 picture; its headline is how many people trusted the traitor, such as
  "3 of 4 humans trusted the AI traitor") and a **share text** with the replay link.

"Trusted the traitor" means: among the people who voted at least once, those who never voted to banish that traitor. The
traitor is the AI one who lasted longest, or a human one if no AI was a traitor. People who never got to vote (murdered on the
first night, say) are left out.

The share text says how many people and AIs were at the table, how that person did at guessing, and the replay link. It says
nothing about who won, who was a traitor, which seats were AIs, or who trusted whom, so it can be posted before anyone has
watched the replay.

## Saved logs

When a game ends the server saves its log as `<LOG_DIR>/room-<code>-seed-<seed>.json`: the same format the command line saves
([LOG.md](LOG.md)), so replay, highlights, cards and stats work on it. In an alias room the seat names are the aliases and the
people's real names are not in the file. The log is written (through a temporary file and a rename) as soon as the game ends,
before any guessing, and it has the host's key scrubbed out like everything else.

The replay link in the share text is `?log=room-<code>-seed-<seed>` on the page's address. It works where that file is in
`web/public/games/` (point `LOG_DIR` there, or copy the file). A log holds every private note, so treat the folder as private
until you choose what to publish.

## AI seats

- **Practice AIs** need no key.
- **Real models** use the host's OpenRouter key, one to seven model IDs (the AI seats take them in
  turn), and a spend cap in US dollars, at most 25. The game stops before a call that could pass it.

### The host's key

The key is sent once, when the room is made. The server keeps it in a private field of that room, in
memory only, and uses it to call OpenRouter. It is:

- never written to a log, an error message or the game log. What a provider sends back is scrubbed as it
  arrives, before anything cuts or reads it (so a key echoed across a truncation point is still found), and
  error text and the finished log are scrubbed again. The retry prompts that carry error text are covered too;
- never sent to any client, including the host;
- erased when the game ends, when the room closes, and when the room expires.

The tests play full games with a fake key and search every log line, console and stdout write, client
message and request body for it, including a rejected key, a timeout and a disconnect
([key-safety test](../tests/server/key-safety.test.ts)). A provider that returns only a masked part of a
key (such as the last four characters) cannot be scrubbed, because the server does not know what it will
print.

## What a client is told

Only its own seat's prompt (what that person may know), the phase ("Night", "Round table"; never who is
acting), and, after the game ends, the log. The phase is sent once when it starts, not once per turn, and the two
recruit phases share one label, so the number of messages says nothing about how many traitors are alive or whether an
offer was made. Never roles, other people's notes or whispers, or who is
waiting. [The hidden-information test](../tests/server/hidden-info.test.ts) plays whole games with four
people over several seeds and checks it.

One thing is not hidden: AI calls and people take different amounts of time, so someone watching how long turns take
could guess which seats are people.

## Limits

| Limit | Value |
|---|---|
| Message size | 8 KiB (larger closes the connection) |
| Rate | 30 messages per 10 seconds per connection; the first refusal says so, later ones are dropped |
| Rooms at once | 50 |
| Connections at once | 400, and 20 per network address |
| Open rooms per network address | 3 (finished rooms do not count) |
| Room lifetime | 2 hours from creation, or 15 minutes after the game ended |
| Guessing after an alias game | 60 seconds |
| Empty lobby | closed after 10 minutes with nobody connected (leaving on purpose frees it at once) |
| People per room | 8 |
| Text | names 20 characters; speech 600; a message or a note 300 |

All text from a person is flattened to one line (no line breaks, so nobody can fake a game line in
another person's prompt), stripped of control and text-direction characters, and cut to its limit. The
pages show it as text and never as HTML.

## Messages

JSON text over a WebSocket. The types are in [`server/protocol.ts`](../server/protocol.ts).

| From the page | Meaning |
|---|---|
| `create` | Make a room (name, practice or real models, optional aliases, optional seed) |
| `join` | Take a seat by room code and name |
| `rejoin` | Take a seat back by room code and seat token |
| `start` | Host only: start the game |
| `leave` | Leave the lobby on purpose (the host leaving closes the room); in a game it does nothing and the seat plays on |
| `answer` | Answer the turn with this number |
| `guess` | After an alias game: the seats you think were AIs |

| From the server | Meaning |
|---|---|
| `joined` | Your seat and your token |
| `lobby` | Who is in the room, and whether it plays under aliases |
| `alias` | Your alias, when an alias game starts (you only) |
| `guess` | Ask for a guess: the seats, your own seat, the time left (you only) |
| `status` | The phase (everyone) |
| `turn` / `turn_over` | Your turn, and that it timed out (you only) |
| `finished` | The log and the outcome (everyone, at the end) |
| `error` / `closed` | A refusal, or that the room is gone |

## Not in the box

Rooms live in memory: stopping the server ends them. Only finished games' logs are saved (see "Saved logs"). There is no spectator
view (a person who is out of the game waits until the end), no way to remove an offline seat, and no
accounts. Deploying it is up to you.
