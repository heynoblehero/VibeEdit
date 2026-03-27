"use client";

import Link from "next/link";

const placeholderProjects = [
	{ id: "1", name: "My Intro", updatedAt: "2 min ago" },
	{ id: "2", name: "Isaac Video", updatedAt: "yesterday" },
	{ id: "3", name: "Demo Reel", updatedAt: "3 days ago" },
];

const placeholderCredits = { used: 53, total: 100 };

export default function DashboardPage() {
	const remaining = placeholderCredits.total - placeholderCredits.used;
	const percentage = (remaining / placeholderCredits.total) * 100;

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Nav */}
			<nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
					<Link href="/" className="text-lg font-bold tracking-tight">
						VibeEdit
					</Link>
					<div className="flex items-center gap-6 text-sm">
						<Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
							Settings
						</Link>
						<button className="text-muted-foreground hover:text-foreground transition-colors">
							Log out
						</button>
					</div>
				</div>
			</nav>

			<div className="mx-auto max-w-4xl px-6 py-12">
				{/* Welcome */}
				<div className="mb-10">
					<h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
					<p className="mt-1 text-muted-foreground">Here is what is happening with your projects.</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Credit Balance */}
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-1">
						<h2 className="text-sm font-medium text-muted-foreground mb-4">Credit Balance</h2>
						<p className="text-3xl font-bold">{remaining}</p>
						<p className="text-sm text-muted-foreground mt-1">credits remaining</p>

						{/* Progress bar */}
						<div className="mt-4 h-2 w-full rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-primary transition-all"
								style={{ width: `${percentage}%` }}
							/>
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							{remaining} / {placeholderCredits.total} credits
						</p>

						<Link
							href="/pricing"
							className="mt-4 block w-full rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted transition-colors"
						>
							Buy More
						</Link>
					</div>

					{/* Quick Actions + Projects */}
					<div className="space-y-6 lg:col-span-2">
						{/* Quick Actions */}
						<div className="flex items-center gap-3">
							<Link
								href="/editor/new"
								className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
							>
								+ New Project
							</Link>
							<Link
								href="/pricing"
								className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
							>
								Buy Credits
							</Link>
						</div>

						{/* Projects List */}
						<div className="rounded-2xl border border-border bg-card shadow-sm">
							<div className="flex items-center justify-between border-b border-border px-6 py-4">
								<h2 className="font-semibold">Your Projects</h2>
								<Link
									href="/editor/new"
									className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
								>
									+ New Project
								</Link>
							</div>

							<div className="divide-y divide-border">
								{placeholderProjects.map((project) => (
									<Link
										key={project.id}
										href={`/editor/${project.id}`}
										className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
									>
										<div className="flex items-center gap-3">
											<span className="text-muted-foreground text-lg">V</span>
											<span className="text-sm font-medium">{project.name}</span>
										</div>
										<span className="text-xs text-muted-foreground">{project.updatedAt}</span>
									</Link>
								))}
							</div>

							{placeholderProjects.length === 0 && (
								<div className="px-6 py-12 text-center">
									<p className="text-sm text-muted-foreground">No projects yet.</p>
									<Link
										href="/editor/new"
										className="mt-2 inline-block text-sm text-primary font-medium hover:text-primary/80 transition-colors"
									>
										Create your first project
									</Link>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Usage Summary */}
				<div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
					<h2 className="font-semibold mb-4">Credit Usage</h2>
					<div className="grid gap-4 sm:grid-cols-4">
						<div>
							<p className="text-2xl font-bold">38</p>
							<p className="text-xs text-muted-foreground">AI Messages</p>
						</div>
						<div>
							<p className="text-2xl font-bold">5</p>
							<p className="text-xs text-muted-foreground">Video Renders</p>
						</div>
						<div>
							<p className="text-2xl font-bold">3</p>
							<p className="text-xs text-muted-foreground">Voice Generations</p>
						</div>
						<div>
							<p className="text-2xl font-bold">7</p>
							<p className="text-xs text-muted-foreground">Caption Generations</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
