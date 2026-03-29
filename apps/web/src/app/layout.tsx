import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
	title: {
		default: "VibeEdit — AI Video Editor",
		template: "%s | VibeEdit",
	},
	description: "Edit videos by talking to AI. 27 AI tools, auto-captions, Remotion effects, and one-click export for every platform.",
	openGraph: {
		title: "VibeEdit — AI Video Editor",
		description: "Edit videos by talking to AI. 27 AI tools, auto-captions, and one-click export.",
		siteName: "VibeEdit",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "VibeEdit — AI Video Editor",
		description: "Edit videos by talking to AI. 27 AI tools, auto-captions, and one-click export.",
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.variable} ${jakarta.variable} font-sans antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					disableTransitionOnChange={true}
				>
					<TooltipProvider>
						<Toaster />
						{children}
					</TooltipProvider>
				</ThemeProvider>
				<Analytics />
			</body>
		</html>
	);
}
