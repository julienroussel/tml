import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getMainModules } from "@/lib/modules";

export default function Home(): ReactElement {
  const modules = getMainModules();

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col" id="main-content">
        {/* Hero */}
        <section
          aria-labelledby="hero-title"
          className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center"
        >
          <div className="flex flex-col items-center gap-3">
            <h1 className="sr-only" id="hero-title">
              The Magic Lab
            </h1>
            <Image
              alt=""
              className="block dark:hidden"
              height={100}
              priority
              src="/logo-light.svg"
              width={300}
            />
            <Image
              alt=""
              className="hidden dark:block"
              height={100}
              priority
              src="/logo-dark.svg"
              width={300}
            />
          </div>
          <p className="max-w-lg text-muted-foreground text-xl leading-relaxed">
            Train. Plan. Perform. Elevate your magic.
          </p>
          <p className="max-w-md text-muted-foreground leading-relaxed">
            A personal workspace built for magicians — organize your repertoire,
            plan routines, track practice sessions, and refine performances.
          </p>
          <Button asChild className="rounded-full" size="lg">
            <Link href="/dashboard">Launch App</Link>
          </Button>
        </section>

        {/* Feature Pillars */}
        <section
          aria-labelledby="features"
          className="border-t bg-muted/30 px-6 py-24"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-12 text-center font-semibold text-2xl tracking-tight"
              id="features"
            >
              Everything you need to level up
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div className="flex flex-col gap-3" key={mod.slug}>
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold">{mod.label}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} The Magic Lab</p>
          <nav aria-label="Footer links" className="flex gap-4">
            <a
              className="transition-colors hover:text-foreground"
              href="https://memdeck.org"
              rel="noopener noreferrer"
              target="_blank"
            >
              MemDeck
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              className="transition-colors hover:text-foreground"
              href="https://github.com/julienroussel/tml"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
