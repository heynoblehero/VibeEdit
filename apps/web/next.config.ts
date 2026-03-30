import type { NextConfig } from "next";

let withContentCollections = (config: NextConfig) => config;
try { withContentCollections = require("@content-collections/next").withContentCollections; } catch {}

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
					{
						key: "Content-Security-Policy",
						value: process.env.NODE_ENV === "production"
							? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; media-src 'self' blob: mediastream:; connect-src 'self' https://api.elevenlabs.io https://api.stability.ai https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none'; worker-src 'self' blob:;"
							: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; media-src 'self' blob: mediastream:; connect-src 'self' http://localhost:* ws://localhost:* https://api.elevenlabs.io https://api.stability.ai https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none'; worker-src 'self' blob:;",
					},
					{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
				],
			},
		];
	},
	turbopack: (() => {
		try {
			return {
				rules: {
					"*.glsl": {
						loaders: [require.resolve("raw-loader")],
						as: "*.js",
					},
				},
			};
		} catch {
			return {};
		}
	})(),
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	webpack: (config) => {
		config.module.rules.push({
			test: /\.glsl$/,
			type: "asset/source",
		});
		return config;
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: false,
	output: "standalone",
	// Disable incremental cache for standalone Docker builds
	cacheHandler: undefined,
	cacheMaxMemorySize: 0,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "plus.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.marblecms.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "api.iconify.design",
			},
			{
				protocol: "https",
				hostname: "api.simplesvg.com",
			},
			{
				protocol: "https",
				hostname: "api.unisvg.com",
			},
		],
	},
};

export default withContentCollections(nextConfig);
