import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="font-semibold text-xl">Page not found</h2>
      <p className="text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
      <Link
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        href="/"
      >
        Go home
      </Link>
    </div>
  );
}
