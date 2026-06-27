import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0c",
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "VibeEdit Video — Claude Code for Video",
  description:
    "Prompt an AI. It writes the video. Built for faceless YouTubers. Renders to MP4 in minutes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "VibeEdit Video",
    description: "Claude Code for Video. For faceless YouTubers.",
    type: "website",
    images: ["/og-default.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeEdit Video",
    description: "Prompt an AI. Get a video.",
    images: ["/og-default.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
