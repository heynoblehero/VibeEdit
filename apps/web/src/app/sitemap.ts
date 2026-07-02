import type { MetadataRoute } from "next";
import { HELP_ARTICLES } from "@/lib/help-articles";
import { liveTools } from "@/lib/tools/catalog";

const SITE_URL = process.env.BETTER_AUTH_URL || "https://vibeedit.video";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "",
    "/pricing",
    "/showcase",
    "/changelog",
    "/status",
    "/help",
    "/tools",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refunds",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  // Free tools are high-intent SEO landing pages.
  const toolRoutes = liveTools().map((tool) => ({
    url: `${SITE_URL}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const helpRoutes = HELP_ARTICLES.filter((article) => article.slug !== "runbook").map(
    (article) => ({
      url: `${SITE_URL}/help/${article.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }),
  );

  return [...staticRoutes, ...toolRoutes, ...helpRoutes];
}
