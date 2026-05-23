import { useEffect, useState, type ReactNode } from 'react';

/**
 * AuthGate used to drive an in-page sign-in flow (Storage Access API,
 * popup window, postMessage handshake) against an auth sidecar fronting
 * the dashboard. That sidecar is gone — authentication happens in
 * bailey-proxy upstream of this container, before any request ever
 * reaches the dashboard SPA. By the time this component mounts the user
 * is already signed in.
 *
 * AuthGate is kept as a thin pass-through so callers don't need to be
 * updated all at once. It performs a single /whoami fetch to verify
 * identity is being forwarded by bailey (so misconfigured deployments
 * surface a clear "no identity on request" instead of mysteriously
 * empty-handed downstream calls), but never blocks rendering once the
 * check finishes.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/whoami', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(() => {
        if (!cancelled) setWarning(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setWarning(
          'Could not confirm identity from bailey: ' + (e?.message ?? String(e)) +
          '. This page may behave as if no user is signed in.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {warning ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#7F1D1D',
            color: '#fff',
            padding: '6px 12px',
            fontSize: 13,
            textAlign: 'center',
          }}
          role="alert"
        >
          {warning}
        </div>
      ) : null}
      {children}
    </>
  );
}
