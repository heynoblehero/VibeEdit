import { OcDataBuddyIcon, OcMarbleIcon } from "@opencut/ui/icons";

export const SITE_URL = "https://vibevideoedit.com";

export const SITE_INFO = {
	title: "VibeEdit",
	description:
		"Edit videos by talking to AI. Drop your files, describe the edit, get a finished video in minutes.",
	url: SITE_URL,
	openGraphImage: "/open-graph/default.jpg",
	twitterImage: "/open-graph/default.jpg",
	favicon: "/favicon.ico",
};

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	icon: React.ElementType;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [
	{
		name: "Marble",
		description:
			"Modern headless CMS for content management and the blog for VibeEdit",
		url: "https://marblecms.com?utm_source=vibeedit",
		icon: OcMarbleIcon,
	},
	{
		name: "Databuddy",
		description: "GDPR compliant analytics and user insights for VibeEdit",
		url: "https://databuddy.cc?utm_source=vibeedit",
		icon: OcDataBuddyIcon,
	},
];

export const DEFAULT_LOGO_URL = "/logos/opencut/svg/logo.svg";

export const SOCIAL_LINKS = {
	x: "https://x.com/vibevideoedit",
	github: "https://github.com/heynoblehero/VibeEdit",
	discord: "https://discord.com/invite/Mu3acKZvCp",
};

export type Sponsor = {
	name: string;
	url: string;
	logo: string;
	description: string;
	invertOnDark?: boolean;
};

export const SPONSORS: Sponsor[] = [
	{
		name: "Fal.ai",
		url: "https://fal.ai?utm_source=vibeedit",
		logo: "/logos/others/fal.svg",
		description: "Generative image, video, and audio models all in one place.",
		invertOnDark: true,
	},
	{
		name: "Vercel",
		url: "https://vercel.com?utm_source=vibeedit",
		logo: "/logos/others/vercel.svg",
		description: "Platform where we deploy and host VibeEdit.",
		invertOnDark: true,
	},
];
