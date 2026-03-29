"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth/client";
import { motion } from "motion/react";
import { NeonBadge } from "@/components/ui/motion/neon-badge";
import {
	Coins,
	Plus,
	Trash2,
	ExternalLink,
	Download,
	LogOut,
	Settings,
	Sparkles,
	FolderPlus,
} from "lucide-react";

interface Project {
	id: string;
	name: string;
	updatedAt: Date | string | null;
	createdAt: Date | string | null;
}

function timeAgo(d: Date | string | null): string {
	if (!d) return "";
	const date = new Date(d);
	const diff = Date.now() - date.getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString();
}

export default function DashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [creditBalance, setCreditBalance] = useState<number | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [newProjectName, setNewProjectName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	useEffect(() => {
		if (!isPending && !session) router.push("/login");
	}, [session, isPending, router]);

	useEffect(() => {
		if (session?.user) {
			fetch("/api/credits").then((r) => r.json()).then((d) => setCreditBalance(d.balance ?? 0)).catch(() => setCreditBalance(0));
			fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || [])).catch(() => setProjects([]));
		}
	}, [session]);

	if (isPending || !session) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="flex items-center gap-3">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	async function handleCreate() {
		if (!newProjectName.trim()) return;
		setIsCreating(true);
		try {
			const id = crypto.randomUUID();
			const resp = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, name: newProjectName.trim() }),
			});
			if (resp.ok) router.push(`/editor/${id}?name=${encodeURIComponent(newProjectName.trim())}`);
		} finally {
			setIsCreating(false);
		}
	}

	async function handleDelete(id: string) {
		await fetch(`/api/projects/${id}`, { method: "DELETE" });
		setProjects((prev) => prev.filter((p) => p.id !== id));
		setDeleteConfirm(null);
	}

	async function handleBackup() {
		const resp = await fetch("/api/projects");
		const data = await resp.json();
		const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: data.projects || [] }, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `vibeedit-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const remaining = creditBalance ?? 0;
	const isLowCredits = remaining < 10;

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Glassmorphism top bar */}
			<header className="glass-strong border-b border-border/40 sticky top-0 z-50">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-6 h-16">
					{/* Logo with gradient icon */}
					<Link href="/" className="flex items-center gap-2.5">
						<div className="gradient-primary flex h-8 w-8 items-center justify-center rounded-full">
							<Sparkles className="h-4 w-4 text-white" />
						</div>
						<span className="text-base font-bold tracking-tight font-[family-name:var(--font-display)]">
							VibeEdit
						</span>
					</Link>

					<div className="flex items-center gap-3">
						{/* Credits pill */}
						<Link
							href="/pricing"
							className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
								isLowCredits
									? "bg-destructive/15 text-destructive border border-destructive/30"
									: "gradient-primary text-white shadow-sm"
							}`}
						>
							<Coins className="h-3.5 w-3.5" />
							<span>{creditBalance === null ? "..." : remaining} credits</span>
						</Link>
						<Link
							href="/settings"
							className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
						>
							<Settings className="h-4 w-4" />
						</Link>
						<button
							onClick={() => signOut().then(() => router.push("/"))}
							className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
						>
							<LogOut className="h-4 w-4" />
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 py-12">
				{/* Welcome section */}
				<motion.div
					className="mb-10"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
				>
					<h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
						{session.user.name ? (
							<>
								Welcome back,{" "}
								<span className="gradient-text bg-clip-text text-transparent">
									{session.user.name}
								</span>
							</>
						) : (
							"Welcome back"
						)}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Your projects
					</p>
				</motion.div>

				{/* New Project + Backup row */}
				<motion.div
					className="flex items-center gap-3 mb-8"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					{!showCreate ? (
						<button
							onClick={() => { setShowCreate(true); setNewProjectName(""); }}
							className="flex items-center gap-2 gradient-primary text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:glow-primary transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
						>
							<Plus className="h-4 w-4" />
							New Project
						</button>
					) : (
						<div className="flex items-center gap-2 flex-1 max-w-md">
							<input
								type="text"
								value={newProjectName}
								onChange={(e) => setNewProjectName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreate()}
								placeholder="Project name..."
								autoFocus
								className="flex-1 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
							/>
							<button
								onClick={handleCreate}
								disabled={!newProjectName.trim() || isCreating}
								className="rounded-full gradient-primary text-white px-5 py-2.5 text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 transition-all active:scale-[0.98]"
							>
								{isCreating ? "..." : "Create"}
							</button>
							<button
								onClick={() => setShowCreate(false)}
								className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-full hover:bg-muted/50 transition-colors"
							>
								Cancel
							</button>
						</div>
					)}
					<button
						onClick={handleBackup}
						className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
						title="Download backup of all projects"
					>
						<Download className="h-3.5 w-3.5" />
						Backup
					</button>
				</motion.div>

				{/* Projects grid */}
				{projects.length === 0 ? (
					<motion.div
						className="bg-card/60 backdrop-blur-sm border-2 border-dashed border-border/40 rounded-2xl py-20 text-center"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.15 }}
					>
						<div className="flex flex-col items-center gap-4">
							<div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-2xl">
								<FolderPlus className="h-7 w-7 text-white" />
							</div>
							<div>
								<h3 className="text-lg font-semibold font-[family-name:var(--font-display)]">
									No projects yet
								</h3>
								<p className="text-muted-foreground text-sm mt-1">
									Create your first project to get started.
								</p>
							</div>
							<button
								onClick={() => { setShowCreate(true); setNewProjectName(""); }}
								className="mt-2 flex items-center gap-2 gradient-primary text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]"
							>
								<Plus className="h-4 w-4" />
								New Project
							</button>
						</div>
					</motion.div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{projects.map((project, i) => (
							<motion.div
								key={project.id}
								className="group relative bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl hover:border-primary/30 transition-colors"
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
								whileHover={{
									y: -2,
									boxShadow: "0 8px 30px hsl(262 83% 58% / 0.1), 0 2px 8px rgba(0,0,0,0.08)",
								}}
							>
								{/* Gradient left border accent on hover */}
								<div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full gradient-primary opacity-0 group-hover:opacity-100 transition-opacity" />

								<Link href={`/editor/${project.id}`} className="block p-6">
									<div className="flex items-start justify-between">
										<div className="min-w-0 flex-1">
											<h3 className="text-sm font-semibold truncate font-[family-name:var(--font-display)]">
												{project.name}
											</h3>
											<p className="text-xs text-muted-foreground mt-1.5">
												{timeAgo(project.updatedAt || project.createdAt)}
											</p>
										</div>
										<ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
									</div>
								</Link>

								{/* Delete button */}
								<div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
									{deleteConfirm === project.id ? (
										<div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-sm rounded-full px-1.5 py-1 border border-border/40">
											<button
												onClick={() => handleDelete(project.id)}
												className="rounded-full px-2.5 py-1 text-[10px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
											>
												Delete
											</button>
											<button
												onClick={() => setDeleteConfirm(null)}
												className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 transition-colors"
											>
												Cancel
											</button>
										</div>
									) : (
										<button
											onClick={() => setDeleteConfirm(project.id)}
											className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
							</motion.div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
