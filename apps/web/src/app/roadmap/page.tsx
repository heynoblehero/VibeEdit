import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Badge } from "@/components/ui/badge";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

const LAST_UPDATED = "March 31, 2026";

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

const roadmapItems: RoadmapItem[] = [
	{
		title: "Project launch",
		description:
			"Repository created, initial project structure, and the vision for an AI-powered video editor that anyone can use.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Core UI & AI chat editor",
		description:
			"Chat-based editing interface, drag-and-drop file upload, real-time video preview, and the AI pipeline that translates plain English into timeline edits.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Auto captions & smart cuts",
		description:
			"AI-powered caption generation with word-level timing, silence/filler-word detection, and automatic dead-air removal.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Multi-format export",
		description:
			"One-click export presets for YouTube, TikTok, Instagram Reels, and Twitter. Automatic resolution, bitrate, and codec selection.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Color grading & effects",
		description:
			"LUT import, AI color matching (\"make it look cinematic\"), transitions library, and text/graphic overlays.",
		status: {
			text: "In progress",
			type: "pending",
		},
	},
	{
		title: "AI storyboard & templates",
		description:
			"Describe a video concept and get a full storyboard with suggested cuts, transitions, and timing. Save and share reusable templates.",
		status: {
			text: "In progress",
			type: "pending",
		},
	},
	{
		title: "Team collaboration",
		description:
			"Shared projects, role-based permissions, comment threads on timeline segments, and real-time collaborative editing.",
		status: {
			text: "Coming soon",
			type: "default",
		},
	},
	{
		title: "Native apps (mobile & desktop)",
		description:
			"Native VibeEdit apps for Mac, Windows, and iOS/Android with offline editing and cloud sync.",
		status: {
			text: "Planned",
			type: "default",
		},
	},
	{
		title: "API & integrations",
		description:
			"REST API for programmatic video editing, webhooks, and integrations with YouTube, TikTok, and social media schedulers.",
		status: {
			text: "Planned",
			type: "default",
		},
	},
];

export const metadata: Metadata = {
	title: "Roadmap - VibeEdit",
	description:
		"See what's coming next for VibeEdit - the free, open-source video editor that respects your privacy.",
	openGraph: {
		title: "VibeEdit Roadmap - What's Coming Next",
		description:
			"See what's coming next for VibeEdit - the free, open-source video editor that respects your privacy.",
		type: "website",
		images: [
			{
				url: "/open-graph/roadmap.jpg",
				width: 1200,
				height: 630,
				alt: "VibeEdit Roadmap",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "VibeEdit Roadmap - What's Coming Next",
		description:
			"See what's coming next for VibeEdit - the free, open-source video editor that respects your privacy.",
		images: ["/open-graph/roadmap.jpg"],
	},
};

export default function RoadmapPage() {
	return (
		<BasePage
			title="Roadmap"
			description={`What's coming next for VibeEdit (last updated: ${LAST_UPDATED})`}
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				<div className="flex flex-col gap-6">
					{roadmapItems.map((item, index) => (
						<RoadmapItem key={item.title} item={item} index={index} />
					))}
				</div>
				<GitHubContributeSection
					title="Want to help?"
					description="VibeEdit is open source and built by the community. Every contribution,
          no matter how small, helps us build the best free video editor
          possible."
				/>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-medium">
				<span className="leading-normal select-none">{index + 1}</span>
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-green-500! text-white": status.type === "complete",
				"bg-yellow-500! text-white": status.type === "pending",
				"bg-blue-500! text-white": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}
