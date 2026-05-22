import type { MetadataRoute } from "next";
import { HELP_ARTICLES } from "@/lib/help-articles";

const SITE_URL = process.env.BETTER_AUTH_URL || "https://vibeedit.video";

export default function sitemap(): MetadataRoute.Sitemap {
	const now = new Date();
	const staticRoutes = [
		"",
		"/showcase",
		"/changelog",
		"/status",
		"/help",
		"/legal/terms",
		"/legal/privacy",
		"/legal/refunds",
	].map((path) => ({
		url: `${SITE_URL}${path}`,
		lastModified: now,
		changeFrequency: "weekly" as const,
		priority: path === "" ? 1 : 0.6,
	}));

	const helpRoutes = HELP_ARTICLES.filter(
		(article) => article.slug !== "runbook",
	).map((article) => ({
		url: `${SITE_URL}/help/${article.slug}`,
		lastModified: now,
		changeFrequency: "monthly" as const,
		priority: 0.5,
	}));

	return [...staticRoutes, ...helpRoutes];
}
