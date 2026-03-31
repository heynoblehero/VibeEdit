import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Pricing",
	description: "Simple monthly plans starting at $19/mo. Credits for AI edits, video exports, captions, and voice generation. Cancel anytime.",
	openGraph: {
		title: "Pricing — VibeEdit",
		description: "Simple monthly plans starting at $19/mo. AI video editing credits that refresh every month.",
	},
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
	return children;
}
