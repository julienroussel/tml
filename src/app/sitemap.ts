import type { MetadataRoute } from "next";

const BASE_URL = "https://themagiclab.app";

const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
