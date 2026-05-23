'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary antialiased h-screen w-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-bg-secondary border border-border-subtle rounded-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-status-error/10 text-status-error rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold">Critical System Error</h2>
          <p className="text-text-secondary">
            We encountered an unexpected error while rendering this page. Our team has been notified.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button
              onClick={() => reset()}
              className="px-6 py-2 bg-accent hover:bg-accent/90 text-white font-medium rounded-md transition-colors"
            >
              Try Again
            </button>
            <Link 
              href="/"
              className="px-6 py-2 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary font-medium rounded-md transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
