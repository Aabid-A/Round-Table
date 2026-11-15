import { useEffect, useRef, type ReactNode } from 'react';
import './shell.css';

/**
 * The game's frame: the room fills the window, dark behind everything, nothing scrolls and there is no page around it. While it is
 * shown the page itself is dark too, so no cream edge shows on a phone's overscroll. On a phone the keyboard's height is tracked, so
 * the input bar sits above the keyboard and nothing covers Send.
 */
export function Shell({ children, label }: { children: ReactNode; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.classList.add('shell-on');
    const vv = window.visualViewport;
    const fit = (): void => {
      if (!vv || !el.current) return;
      // What the on-screen keyboard (or anything else) hides at the bottom of the window.
      const hidden = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      el.current.style.setProperty('--kb', `${Math.round(hidden)}px`);
    };
    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    return () => {
      document.documentElement.classList.remove('shell-on');
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
    };
  }, []);
  return (
    <div className="shell" data-testid="shell" role="region" aria-label={label} ref={el}>
      {children}
    </div>
  );
}
