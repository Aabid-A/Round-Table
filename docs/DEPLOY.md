# Hosting it

Two things to host, both optional and independent:

- **The site**: static files. Replay, recording mode, cards, the guess game, the stats page and solo play all run in the
  browser. Any static file host works.
- **The room server**: one Node process, only if you want rooms ("play with friends", "Human or AI?").

Nothing here is tied to a vendor, and nothing is deployed by this repository.

## The static site

```bash
npm ci
npm run build:web
```

`web/dist/` is the site. Copy its contents to any web server or static host. It uses relative paths, so it works at the root
of a domain or in a folder (checked from `/shows/round-table/` on a plain static server). Pages are chosen by the address:

| Address | Page |
|---|---|
| `/?log=<name>` | Replay of `web/public/games/<name>.json` |
| `/?mode=record&log=<name>` | Recording mode (the clip camera) |
| `/?mode=guess&episode=today` | Guess the traitor |
| `/?page=episodes` | The episode list |
| `/?page=stats` | The Betrayal Index (reads `stats.json`) |
| `/?mode=play` | Take a seat (solo) |
| `/?mode=room` | Rooms |

No server-side routing is needed: everything after `?` is read by the page.

### What goes in `web/public/games/`

Whatever is there when you build is **published**: every `.json` in `web/public/games/` is copied to `web/dist/games/`, and
the page downloads a whole log to play it. A log holds every private note and every role, so:

- keep only logs you mean to publish (delete mock logs before the real build);
- `npm run episodes -- web/public/games` writes the episode list (`index.json`, with no winners or roles);
- `web/public/stats.json` (from `npm run stats`) is published the same way.

A viewer who opens the network tab can read the roles of a guess-game episode. It is a game, not a vault.

## The room server

Needs Node 22 and a full install. `tsx` and `ws` are development dependencies in this repository, so **do not** use
`npm ci --omit=dev` (checked: the server then fails with `tsx: not found`).

```bash
npm ci
PORT=8787 npm run rooms
```

Rooms live in memory: stopping or restarting the process ends every room. Run it under whatever keeps processes alive
(systemd, a container, a process manager). It stops cleanly on `SIGINT` and `SIGTERM`, telling everyone in a room that the
server is stopping.

### Environment variables for the server

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | Port to listen on. |
| `HOST` | all addresses | Address to bind. Use `127.0.0.1` when a proxy on the same machine fronts it. |
| `TURN_MS` | 90000 | How long a person has for one turn (100 to 86400000). |
| `ABANDON_MS` | 120000 | How long a running game may have nobody connected before its room closes. |
| `MAX_ROOMS_PER_ADDRESS` | 3 | Open rooms one network address may have (finished rooms do not count). |
| `MAX_CONNECTIONS_PER_ADDRESS` | 20 | Connections one network address may hold. |
| `TRUST_PROXY` | off | `1` only behind exactly one reverse proxy you run. The client's address is then the last `X-Forwarded-For` entry, and a room with real models is refused unless the last `X-Forwarded-Proto` is `https` (so your proxy must set that header). |
| `ALLOWED_ORIGINS` | any origin | Comma-separated origins allowed to connect, such as `https://play.example.org`. Each is `scheme://host` or `scheme://host:port`, with no path and no `*`. When set, any other origin, and any connection that sends no `Origin` header, is refused with a 403 before it connects. |
| `LOG_DIR` | `games` | Where each finished room game's log is saved. `LOG_DIR=none` turns saving off. |
| `ALLOW_SEED` | off | **Never set this in production.** It lets a page choose a room's seed, and the seed decides every role. For tests. |

A bad number for `PORT`, `TURN_MS`, `ABANDON_MS` or the two `MAX_` settings stops the server at start with a message naming the
variable. The on/off settings (`TRUST_PROXY`, `ALLOW_SEED`) are on only when set to exactly `1`; any other value leaves them off.
Details of each, the limits, and
what the server never sends to a client: [ROOMS.md](ROOMS.md).

The server does not need `OPENROUTER_API_KEY`. In a room, the host types their own key into the page; the server holds it in
memory for that room only, uses it for that room's AI seats, scrubs it from everything it logs or sends, and forgets it when
the game ends or the room closes.

### Environment variable for the page

| Variable | Where | Meaning |
|---|---|---|
| `VITE_ROOM_SERVER` | when you **build** the site (or run `npm run web`) | The room server's address, such as `wss://rooms.example.org`. Without it the page uses port 8787 on its own host. |

```bash
VITE_ROOM_SERVER=wss://rooms.example.org npm run build:web
```

(Checked: the address is baked into the built script only when this is set.) It is read at build time and never from the
page's address, so a link cannot point a host's key at another server.

### TLS

A page served over `https` can only open `wss://` connections to the room server, so put the server behind TLS. Hosts type
their OpenRouter key into the page, so do not run it over plain `ws://` anywhere but your own machine.

With `TRUST_PROXY=1` the server enforces this: a create message for a room with real models is refused unless the proxy says
the client used https (the last `X-Forwarded-Proto` entry). Practice rooms are not affected. Without `TRUST_PROXY` the server
cannot tell and does not guess, so it takes the key as it always did.

### A reverse proxy

A proxy must pass WebSocket upgrades through. The nginx example below has **not been run** as part of this repository
(no proxy was available to test it); treat it as a starting point. With `TRUST_PROXY=1` the server reads the client's
address from the last `X-Forwarded-For` entry, which `$proxy_add_x_forwarded_for` appends:

```nginx
server {
  listen 443 ssl;
  server_name rooms.example.org;
  # ssl_certificate and ssl_certificate_key here

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
  }
}
```

Run the server with `HOST=127.0.0.1 TRUST_PROXY=1 ALLOWED_ORIGINS=https://play.example.org PORT=8787 npm run rooms`. If you cannot make the proxy the only way in
(someone can reach the server directly), leave `TRUST_PROXY` off: a client could otherwise send the header itself.

### The host's key

A host who makes a room with real models types their OpenRouter key into the page, and the page sends it to **this server**. The
page says so, naming the server, before the host pastes anything. The server holds the key in memory for that room only, uses it
for the room's AI seats, scrubs it from everything it logs or sends, and forgets it when the game ends. But the person running
the server runs the code that receives it, so a host is trusting you. Tell your hosts to:

- **use a dedicated OpenRouter key with a credit limit**, made for this, and not their main key. OpenRouter lets you set a credit
  limit when you create a key (and have it reset daily, weekly or monthly), so even a lost or misused key can only spend that
  much;
- and delete or rotate that key afterwards if they like.

On top of that, each room has its own spend cap (at most 25 dollars, chosen by the host). A call to a real model that comes back
with no cost, or fails or times out, is counted at the largest cost seen so far in that game (or 0.01 dollars if none yet), so a
provider that is failing cannot spend without the cap noticing; and every game has a hard limit on calls to players that does not
depend on cost ([LOG.md](LOG.md#the-limit-on-calls)). These are limits on this server's side, not a substitute for the key's own
credit limit.

### Room logs

Finished games are saved as `<LOG_DIR>/room-<code>-seed-<seed>.json`, in the format everything else reads. There is no limit
on how many pile up: clear the folder when you like. A log holds every private note, so do not point `LOG_DIR` at a folder
you serve unless you mean to publish those games.

## Checks

- The site: open `/?page=episodes` on the host.
- The room server: `npm run rooms` prints `listening on port <n>` and where logs are saved. Open `/?mode=room`, make a room with
  practice AIs, and start a game from a second browser.
- Behind a proxy: with `TRUST_PROXY=1`, make a room with real models over `http` (it should be refused with a message about https)
  and over `https` (it should work).
- With `ALLOWED_ORIGINS`: the page on a listed origin connects; a page on any other origin cannot (the browser shows the connection
  failing, and the server answers 403).
- Before publishing logs: the key check in [EPISODE.md](EPISODE.md#before-you-post).
