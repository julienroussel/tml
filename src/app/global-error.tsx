"use client";

import type { ReactElement } from "react";
import { useEffect, useRef } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (error) {
      mainRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Error | The Magic Lab";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main
          className="flex min-h-screen flex-col items-center justify-center gap-4"
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          <div role="alert">
            <h1 className="font-semibold text-xl">Something went wrong</h1>
            <p className="text-muted-foreground">
              An unexpected error occurred.
            </p>
          </div>
          <button
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
