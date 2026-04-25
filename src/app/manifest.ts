import type { MetadataRoute } from "next";

// PWA manifest. Picked up at /manifest.webmanifest by Next 16's metadata
// API. Lets users "Add to Home Screen" with a real icon and standalone
// display mode (no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VibeEdit Studio",
    short_name: "VibeEdit",
    description: "AI video editor — describe it, the agent builds it.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#10b981",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
