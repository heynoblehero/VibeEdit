"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Resolution = "720p" | "1080p" | "4K";
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

const resolutions: Record<Resolution, Record<AspectRatio, { w: number; h: number }>> = {
	"720p": { "16:9": { w: 1280, h: 720 }, "9:16": { w: 720, h: 1280 }, "1:1": { w: 720, h: 720 }, "4:5": { w: 576, h: 720 } },
	"1080p": { "16:9": { w: 1920, h: 1080 }, "9:16": { w: 1080, h: 1920 }, "1:1": { w: 1080, h: 1080 }, "4:5": { w: 864, h: 1080 } },
	"4K": { "16:9": { w: 3840, h: 2160 }, "9:16": { w: 2160, h: 3840 }, "1:1": { w: 2160, h: 2160 }, "4:5": { w: 1728, h: 2160 } },
};

const aspectRatios: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];

export default function Home() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [resolution, setResolution] = useState<Resolution>("1080p");
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
	const [isCreating, setIsCreating] = useState(false);

	const handleCreate = async () => {
		setIsCreating(true);
		const projectId = crypto.randomUUID();
		router.push(`/editor/${projectId}?name=${encodeURIComponent(name || "Untitled Project")}`);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !isCreating) {
			handleCreate();
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold text-foreground tracking-tight">VibeEdit</h1>
					<p className="text-sm text-muted-foreground mt-1">AI-Powered Video Editor</p>
				</div>

				{/* Form Card */}
				<div className="rounded-2xl bg-card border border-border shadow-sm p-6">
					<h2 className="text-lg font-semibold text-foreground mb-5">New Project</h2>

					{/* Project Name */}
					<div className="mb-4">
						<label className="block text-sm font-medium text-muted-foreground mb-1.5">Project Name</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="My awesome video"
							className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							autoFocus
						/>
					</div>

					{/* Resolution */}
					<div className="mb-4">
						<label className="block text-sm font-medium text-muted-foreground mb-1.5">Resolution</label>
						<select
							value={resolution}
							onChange={(e) => setResolution(e.target.value as Resolution)}
							className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none"
						>
							<option value="720p">720p (HD)</option>
							<option value="1080p">1080p (Full HD)</option>
							<option value="4K">4K (Ultra HD)</option>
						</select>
					</div>

					{/* Aspect Ratio */}
					<div className="mb-6">
						<label className="block text-sm font-medium text-muted-foreground mb-1.5">Aspect Ratio</label>
						<div className="grid grid-cols-4 gap-2">
							{aspectRatios.map((ratio) => (
								<button
									key={ratio}
									onClick={() => setAspectRatio(ratio)}
									className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
										aspectRatio === ratio
											? "border-primary bg-primary/10 text-primary"
											: "border-border text-muted-foreground hover:border-muted-foreground/30"
									}`}
								>
									{ratio}
								</button>
							))}
						</div>
						<p className="text-xs text-muted-foreground mt-1.5">
							{resolution} • {resolutions[resolution][aspectRatio].w}x{resolutions[resolution][aspectRatio].h}
						</p>
					</div>

					{/* Create Button */}
					<button
						onClick={handleCreate}
						disabled={isCreating}
						className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
					>
						{isCreating ? "Creating..." : "Create Project"}
					</button>
				</div>

				{/* Quick start hint */}
				<p className="text-center text-xs text-muted-foreground mt-4">
					Press Enter to create with defaults
				</p>
			</div>
		</div>
	);
}
