import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "The Magic Lab",
    short_name: "Magic Lab",
    description:
      "A personal workspace for magicians to organize your repertoire, plan routines, track practice sessions, and refine performances.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "en",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["productivity", "entertainment"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "The Magic Lab landing page on desktop",
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "The Magic Lab landing page on mobile",
      },
    ],
    shortcuts: [
      {
        name: "Log Practice",
        url: "/improve",
        description: "Log a practice session",
      },
      {
        name: "My Routines",
        url: "/plan",
        description: "View and manage your routines",
      },
    ],
  };
}
