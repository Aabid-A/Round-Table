import { useEffect, useRef } from 'react';

const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.closest('input, textarea, select, [contenteditable="true"]') !== null);

/** The J key opens and closes the journal, except while typing. */
export function useJournalKey(toggle: () => void): void {
  const latest = useRef(toggle);
  latest.current = toggle;
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** "What you know": your own prompt's history, in a panel that slides over the room. Escape or the button closes it. */
export function Journal({ open, text, onClose }: { open: boolean; text: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <aside className="journal" data-open={open} aria-hidden={!open} inert={!open} aria-label="Journal" data-testid="journal">
      <header>
        <h2>What you know</h2>
        <button type="button" className="hud-btn" ref={close} onClick={onClose}>
          Close
        </button>
      </header>
      <pre tabIndex={0} aria-label="What you know so far">
        {text.trim() === '' ? 'Nothing yet.' : text}
      </pre>
    </aside>
  );
}
