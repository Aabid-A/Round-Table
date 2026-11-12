interface Props {
  index: number;
  count: number;
  playing: boolean;
  showNotes: boolean;
  /** True when sitting in a seat: a player has no one else's notes to show. */
  notesLocked?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSeek: (i: number) => void;
  onNotes: (on: boolean) => void;
  onReload: () => void;
}

export function Controls(p: Props) {
  return (
    <section className="controls" aria-label="Playback">
      <div className="controls-row">
        <button type="button" className="btn" onClick={p.onPrev} disabled={p.index === 0}>
          Previous
        </button>
        <button type="button" className="btn btn-primary" onClick={p.onToggle}>
          {p.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn" onClick={p.onNext} disabled={p.index >= p.count - 1}>
          Next
        </button>
        <input
          className="scrub"
          type="range"
          min={0}
          max={p.count - 1}
          value={p.index}
          aria-label="Step"
          aria-valuetext={`Step ${p.index + 1} of ${p.count}`}
          onChange={(e) => p.onSeek(Number(e.target.value))}
        />
        <span className="muted" aria-hidden="true">
          {p.index + 1} / {p.count}
        </span>
      </div>
      <div className="controls-row">
        {!p.notesLocked && (
          <label className="switch">
            <input type="checkbox" checked={p.showNotes} onChange={(e) => p.onNotes(e.target.checked)} />
            Show private notes
          </label>
        )}
        <button type="button" className="btn" onClick={p.onReload}>
          Load another log
        </button>
      </div>
      <p className="hint">Space plays or pauses. Left and right arrows step.</p>
    </section>
  );
}
