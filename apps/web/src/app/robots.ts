import type { MetadataRoute } from "next";

const SITE_URL = process.env.BETTER_AUTH_URL || "https://vibeedit.video";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				// Authenticated dashboards + share-by-slug pages are unindexable;
				// crawlers will get redirects/no-content anyway, but be explicit.
				disallow: ["/app/", "/api/", "/share/", "/early"],
			},
		],
		sitemap: `${SITE_URL}/sitemap.xml`,
		host: SITE_URL,
	};
}
