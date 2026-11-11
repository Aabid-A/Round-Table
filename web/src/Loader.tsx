import { useId } from 'react';

interface Props {
  status: 'idle' | 'loading' | 'error';
  message: string | null;
  onFile: (file: File) => void;
}

/** First screen: choose a game log. Also the empty, loading and error states. */
export function Loader({ status, message, onFile }: Props) {
  const inputId = useId();
  return (
    <main className="loader">
      <h1>Round Table replay</h1>
      <p className="muted">
        Watch a game like an episode. Choose a log written by <code>npm run game</code>, or open this page with{' '}
        <code>?log=name</code> for a file in <code>web/public/games/</code>.
      </p>
      {status === 'loading' && (
        <p className="notice" role="status">
          Loading {message ?? 'the log'}…
        </p>
      )}
      {status === 'error' && message && (
        <p className="notice notice-error" role="alert">
          {message}
        </p>
      )}
      <div>
        <label className="btn btn-primary file-label" htmlFor={inputId}>
          Choose a game log
          <input
            id={inputId}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </main>
  );
}
