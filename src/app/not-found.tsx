import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not Found",
};

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      id="main-content"
    >
      <h1 className="font-semibold text-xl">Page not found</h1>
      <p className="text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
      <Link
        aria-label="Go to homepage"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        href="/"
      >
        Go home
      </Link>
    </main>
  );
}
