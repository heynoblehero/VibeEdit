import type { NextConfig } from "next";

const config: NextConfig = {
	serverExternalPackages: [
		"@hyperframes/producer",
		"@hyperframes/core",
		"@hyperframes/engine",
		"better-sqlite3",
		"chokidar",
		"esbuild",
		"sharp",
	],
	experimental: {
		serverActions: { bodySizeLimit: "50mb" },
	},
	turbopack: {
		rules: {
			"*.md": { loaders: ["raw-loader"], as: "*.js" },
		},
	},
	async redirects() {
		return [
			{ source: "/login", destination: "/app/login", permanent: false },
			{ source: "/signin", destination: "/app/login", permanent: false },
			{ source: "/sign-in", destination: "/app/login", permanent: false },
			{ source: "/signup", destination: "/app/signup", permanent: false },
			{ source: "/sign-up", destination: "/app/signup", permanent: false },
			{ source: "/register", destination: "/app/signup", permanent: false },
		];
	},
};

export default config;
