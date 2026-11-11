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
| Connections at once | 400 |
| Room lifetime | 2 hours from creation, or 15 minutes after the game ended |
| People per room | 8 |
| Text | names 20 characters; speech 600; a message or a note 300 |

All text from a person is flattened to one line (no line breaks, so nobody can fake a game line in
another person's prompt), stripped of control and text-direction characters, and cut to its limit. The
pages show it as text and never as HTML.

## Messages

JSON text over a WebSocket. The types are in [`server/protocol.ts`](../server/protocol.ts).

| From the page | Meaning |
|---|---|
| `create` | Make a room (name, practice or real models, optional seed) |
| `join` | Take a seat by room code and name |
| `rejoin` | Take a seat back by room code and seat token |
| `start` | Host only: start the game |
| `answer` | Answer the turn with this number |

| From the server | Meaning |
|---|---|
| `joined` | Your seat and your token |
| `lobby` | Who is in the room |
| `status` | The phase (everyone) |
| `turn` / `turn_over` | Your turn, and that it timed out (you only) |
| `finished` | The log (everyone, at the end) |
| `error` / `closed` | A refusal, or that the room is gone |

## Not in the box

Rooms live in memory: stopping the server ends them. Nothing is saved on the server. There is no spectator
view (a person who is out of the game waits until the end), no way to remove an offline seat, and no
accounts. Deploying it is up to you.
