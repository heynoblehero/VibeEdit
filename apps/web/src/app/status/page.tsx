import type { Metadata } from "next";
import { StatusBoard } from "./StatusBoard";

export const metadata: Metadata = {
  title: "Status — VibeEdit",
  description:
    "Live system status for VibeEdit — per-dependency health for renders, storage, database, and the AI provider.",
  alternates: { canonical: "/status" },
  openGraph: {
    title: "VibeEdit Status",
    description: "Live per-dependency system status for VibeEdit.",
    type: "website",
    url: "/status",
    siteName: "VibeEdit",
  },
};

export default function StatusPage() {
  return <StatusBoard />;
}
