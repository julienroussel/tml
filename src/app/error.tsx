"use client";

import { useEffect, useRef } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Re-focus when the error changes so users notice a new error
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
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
    >
      <div role="alert">
        <h1 className="font-semibold text-xl">Something went wrong</h1>
        <p className="text-muted-foreground">An unexpected error occurred.</p>
      </div>
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
