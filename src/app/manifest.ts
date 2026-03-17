import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Magic Lab",
    short_name: "Magic Lab",
    description:
      "A personal workspace for magicians to organize your repertoire, plan routines, track practice sessions, and refine performances.",
    start_url: "/dashboard",
    display: "standalone",
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
