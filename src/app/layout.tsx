import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { authClient } from "@/auth/client";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DynamicIntlProvider } from "@/i18n/client-provider";
import { defaultLocale, isLocale } from "@/i18n/config";
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
    "A personal workspace for magicians to organize their repertoire, plan routines, track practice sessions, and refine performances.",
  keywords: [
    "magic",
    "magician",
    "practice",
    "repertoire",
    "routine",
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
      "A personal workspace for magicians to organize their repertoire, plan routines, track practice sessions, and refine performances.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const [locale, messages, t, headersList] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
    headers(),
  ]);
  const nonce = headersList.get("x-nonce") ?? undefined;
  const typedLocale = isLocale(locale) ? locale : defaultLocale;

  return (
    <html lang={typedLocale} suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          nonce={nonce}
        >
          <NeonAuthUIProvider
            authClient={authClient}
            emailOTP
            social={{ providers: ["google"] }}
          >
            <DynamicIntlProvider
              initialLocale={typedLocale}
              initialMessages={messages}
            >
              <a
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
                href="#main-content"
              >
                {t("skipToContent")}
              </a>
              {children}
              <Toaster />
            </DynamicIntlProvider>
          </NeonAuthUIProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
