"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="font-semibold text-xl">Something went wrong</h2>
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
