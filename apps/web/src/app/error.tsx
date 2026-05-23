'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Route Error Caught:', error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-bg-secondary border border-border-subtle rounded-xl p-8 text-center space-y-6">
        <div className="w-12 h-12 bg-status-warning/10 text-status-warning rounded-full flex items-center justify-center mx-auto mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Something went wrong!</h2>
        <p className="text-sm text-text-secondary">
          A component failed to render. You can try recovering the page.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-medium rounded-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
