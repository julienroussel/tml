import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { ThemeProvider } from "@/components/theme-provider";
import { LANG_SCRIPT } from "@/lib/lang-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://themagiclab.app"),
  title: {
    default: "The Magic Lab",
    template: "%s | The Magic Lab",
  },
  description:
    "A personal workspace for magicians to organize their repertoire, plan setlists, track practice sessions, and refine performances.",
  keywords: [
    "magic",
    "magician",
    "practice",
    "repertoire",
    "setlist",
    "performance",
    "training",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Magic Lab",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "The Magic Lab",
    description:
      "A personal workspace for magicians to organize their repertoire, plan setlists, track practice sessions, and refine performances.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        {/* Sync <html lang> with the user's locale before first paint.
            See src/lib/lang-script.ts for detection logic. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: blocking inline script for a11y — same pattern as next-themes anti-flicker */}
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
