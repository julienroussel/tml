export default function Loading() {
  return (
    <output className="flex min-h-screen items-center justify-center">
      <div className="border-muted border-t-primary size-8 animate-spin rounded-full border-4" />
      <span className="sr-only">Loading…</span>
    </output>
  );
}
