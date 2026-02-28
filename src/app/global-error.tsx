"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h2 className="font-semibold text-xl">Something went wrong</h2>
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
