import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted font-sans">
      <main
        className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between bg-background px-16 py-32 sm:items-start"
        id="main-content"
      >
        <Image
          alt="Next.js logo"
          className="dark:invert"
          height={20}
          priority
          src="/next.svg"
          width={100}
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs font-semibold text-3xl text-foreground leading-10 tracking-tight">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground leading-8">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2"
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2"
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 font-medium text-base sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 md:w-40"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Image
              alt="Vercel logomark"
              className="dark:invert"
              height={16}
              src="/vercel.svg"
              width={16}
            />
            Deploy Now
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-border px-5 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 md:w-40"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            rel="noopener noreferrer"
            target="_blank"
          >
            Documentation
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </main>
    </div>
  );
}
