import { useEffect, useMemo } from 'react';
import { useRoomChoice } from '../scene/host.js';
import { hallView } from './hall.js';
import { HallRoom } from './HallRoom.js';
import { Shell } from './Shell.js';

const ACTIONS = [
  { href: '?mode=play', label: 'Play', test: 'title-play' },
  { href: '?mode=room', label: 'Play with friends', test: 'title-friends' },
  { href: '?page=episodes', label: 'Watch an episode', test: 'title-watch' },
];

function Actions() {
  return (
    <>
      <nav className="title-actions" aria-label="Start">
        {ACTIONS.map((a) => (
          <a key={a.href} href={a.href} data-testid={a.test}>
            {a.label}
          </a>
        ))}
      </nav>
      <p className="title-more">
        <a href="?mode=replay">Open a game log</a> · <a href="?page=stats">Season stats</a>
      </p>
    </>
  );
}

/** The front door: the hall, the camera drifting slowly round the empty table, the name, and the ways in. The ?mode= addresses still work. */
export function TitleScreen() {
  const choice = useRoomChoice(window.location.search);
  const view = useMemo(() => hallView({ you: null, drift: true }), []);
  useEffect(() => {
    document.title = 'Round Table';
  }, []);
  if (!choice.room) {
    return (
      <main className="loader title-plain" data-testid="title">
        <h1>Round Table</h1>
        <p className="muted">A game of traitors and faithfuls, played by AIs and people at one table.</p>
        <Actions />
      </main>
    );
  }
  return (
    <Shell label="Round Table">
      <HallRoom view={view} choice={choice} />
      <div className="title" data-testid="title">
        <h1>Round Table</h1>
        <Actions />
      </div>
    </Shell>
  );
}
