"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth/client";

interface Project {
	id: string;
	name: string;
	updatedAt: Date | string | null;
	createdAt: Date | string | null;
}

export default function DashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [creditBalance, setCreditBalance] = useState<number | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [showNewProject, setShowNewProject] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	useEffect(() => {
		if (!isPending && !session) {
			router.push("/login");
		}
	}, [session, isPending, router]);

	useEffect(() => {
		if (session?.user) {
			fetch("/api/credits")
				.then((r) => r.json())
				.then((d) => setCreditBalance(d.balance ?? 0))
				.catch(() => setCreditBalance(0));
			loadProjects();
		}
	}, [session]);

	function loadProjects() {
		fetch("/api/projects")
			.then((r) => r.json())
			.then((d) => setProjects(d.projects || []))
			.catch(() => setProjects([]));
	}

	if (isPending || !session) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const remaining = creditBalance ?? 0;

	async function handleLogout() {
		await signOut();
		router.push("/");
	}

	async function handleCreateProject() {
		if (!newProjectName.trim()) return;
		setIsCreating(true);
		try {
			const id = crypto.randomUUID();
			// Save to database first
			const resp = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, name: newProjectName.trim() }),
			});
			if (resp.ok) {
				router.push(`/editor/${id}?name=${encodeURIComponent(newProjectName.trim())}`);
			}
		} finally {
			setIsCreating(false);
		}
	}

	async function handleDeleteProject(id: string) {
		await fetch(`/api/projects/${id}`, { method: "DELETE" });
		setProjects((prev) => prev.filter((p) => p.id !== id));
		setDeleteConfirm(null);
	}

	async function handleBackup() {
		const resp = await fetch("/api/projects");
		const data = await resp.json();
		const backup = {
			version: 1,
			exportedAt: new Date().toISOString(),
			projects: data.projects || [],
		};
		const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `vibeedit-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatDate(d: Date | string | null): string {
		if (!d) return "";
		const date = new Date(d);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	}

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
						<button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors">
							Log out
						</button>
					</div>
				</div>
			</nav>

			<div className="mx-auto max-w-4xl px-6 py-12">
				{/* Welcome */}
				<div className="mb-10">
					<h1 className="text-3xl font-bold tracking-tight">
						Welcome back{session.user.name ? `, ${session.user.name}` : ""}
					</h1>
					<p className="mt-1 text-muted-foreground">Create a new project or continue editing an existing one.</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Credit Balance */}
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-1">
						<h2 className="text-sm font-medium text-muted-foreground mb-4">Credit Balance</h2>
						<p className="text-3xl font-bold">{creditBalance === null ? "..." : remaining}</p>
						<p className="text-sm text-muted-foreground mt-1">credits remaining</p>
						<Link
							href="/pricing"
							className="mt-4 block w-full rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted transition-colors"
						>
							Buy More
						</Link>
						<button
							onClick={handleBackup}
							className="mt-2 block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
						>
							Backup All Projects
						</button>
					</div>

					{/* Projects */}
					<div className="space-y-4 lg:col-span-2">
						{/* New Project Button / Form */}
						{!showNewProject ? (
							<button
								onClick={() => { setShowNewProject(true); setNewProjectName(""); }}
								className="w-full rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center hover:border-primary/50 hover:bg-card transition-all"
							>
								<div className="flex flex-col items-center gap-2">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M12 5v14M5 12h14" /></svg>
									</div>
									<span className="text-sm font-medium">New Project</span>
									<span className="text-xs text-muted-foreground">Start editing a new video</span>
								</div>
							</button>
						) : (
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<h3 className="text-sm font-semibold mb-3">Create New Project</h3>
								<input
									type="text"
									value={newProjectName}
									onChange={(e) => setNewProjectName(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
									placeholder="My awesome video"
									autoFocus
									className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
								/>
								<div className="flex items-center gap-2 mt-3">
									<button
										onClick={handleCreateProject}
										disabled={!newProjectName.trim() || isCreating}
										className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
									>
										{isCreating ? "Creating..." : "Create & Open Editor"}
									</button>
									<button
										onClick={() => setShowNewProject(false)}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										Cancel
									</button>
								</div>
							</div>
						)}

						{/* Projects List */}
						<div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
							<div className="border-b border-border px-6 py-4">
								<h2 className="font-semibold">Your Projects</h2>
							</div>

							{projects.length === 0 ? (
								<div className="px-6 py-12 text-center">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
											<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="m2 14 6-6" /><path d="m14 20 8-8" />
										</svg>
									</div>
									<p className="text-sm text-muted-foreground">No projects yet.</p>
									<p className="text-xs text-muted-foreground mt-1">Create your first project to get started.</p>
								</div>
							) : (
								<div className="divide-y divide-border">
									{projects.map((project) => (
										<div key={project.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors group">
											<Link href={`/editor/${project.id}`} className="flex-1 flex items-center gap-3 min-w-0">
												<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
														<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
													</svg>
												</div>
												<div className="min-w-0">
													<p className="text-sm font-medium truncate">{project.name}</p>
													<p className="text-xs text-muted-foreground">{formatDate(project.updatedAt || project.createdAt)}</p>
												</div>
											</Link>
											<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
												<Link
													href={`/editor/${project.id}`}
													className="rounded-md px-2.5 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
												>
													Edit
												</Link>
												{deleteConfirm === project.id ? (
													<div className="flex items-center gap-1">
														<button
															onClick={() => handleDeleteProject(project.id)}
															className="rounded-md px-2 py-1 text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
														>
															Confirm
														</button>
														<button
															onClick={() => setDeleteConfirm(null)}
															className="text-xs text-muted-foreground"
														>
															Cancel
														</button>
													</div>
												) : (
													<button
														onClick={() => setDeleteConfirm(project.id)}
														className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
													>
														Delete
													</button>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
