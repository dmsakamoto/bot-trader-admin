'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen grid place-items-center">
        <div className="w-96 p-6 rounded-lg border border-neutral-800 space-y-3 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-neutral-400">
            The error has been reported. Try again or contact the app owner if it persists.
          </p>
          {error.digest && (
            <p className="text-xs text-neutral-600 mono">Digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2 text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
