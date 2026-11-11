import { useEffect, useState } from 'react';
import './card.css';
import type { GameLog } from '../../../src/engine/types.js';
import { loadFromName } from '../load.js';
import { Card } from './Card.js';
import { parseCardParams } from './params.js';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; log: GameLog };

/**
 * ?card=<turn>&log=<name>[&size=...]: one quote card at its exact pixel size, top-left, so a screenshot of the card
 * (or of a viewport the size of the card) is the finished image. Sets data-ready on the page when it is drawn.
 */
export function CardPage() {
  const parsed = parseCardParams(window.location.search);
  const [state, setState] = useState<State>(parsed.ok ? { kind: 'loading' } : { kind: 'error', message: parsed.message });

  useEffect(() => {
    document.title = 'Round Table card';
    if (!parsed.ok) return;
    void loadFromName(parsed.params.log, import.meta.env.BASE_URL).then((r) =>
      setState(r.ok ? { kind: 'ready', log: r.log } : { kind: 'error', message: r.message }),
    );
    // The search string does not change while the page is open.
  }, []);

  if (!parsed.ok || state.kind === 'error') {
    return (
      <p className="rec-error" role="alert">
        {state.kind === 'error' ? state.message : ''}
      </p>
    );
  }
  if (state.kind === 'loading') return <p className="rec-error" role="status">Loading the card…</p>;
  return (
    <div className="card-page" data-ready="true">
      <Card log={state.log} logName={parsed.params.log} turnId={parsed.params.turn} size={parsed.params.size} />
    </div>
  );
}
