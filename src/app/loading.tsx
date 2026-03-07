export default function Loading() {
  return (
    <output className="flex min-h-screen items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <span className="sr-only">Loading…</span>
    </output>
  );
}
