"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth/client";
import { motion } from "motion/react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import {
	Coins, Plus, Trash2, Download, LogOut,
	Settings, Sparkles, FolderPlus, ArrowRight, Video,
	Upload, Play, CreditCard, Film, Calendar,
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

function memberSince(d: Date | string | null | undefined): string {
	if (!d) return "Recently";
	const date = new Date(d);
	return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Deterministic color from project name
function projectGradient(name: string) {
	const gradients = [
		"from-violet-500 to-purple-600",
		"from-fuchsia-500 to-pink-600",
		"from-cyan-500 to-blue-600",
		"from-emerald-500 to-green-600",
		"from-amber-500 to-orange-600",
		"from-rose-500 to-red-600",
		"from-indigo-500 to-violet-600",
		"from-teal-500 to-cyan-600",
	];
	let hash = 0;
	for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
	return gradients[Math.abs(hash) % gradients.length];
}

export default function DashboardPageWrapper() {
	return (
		<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Loading...</p></div>}>
			<DashboardPage />
		</Suspense>
	);
}

function DashboardPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session, isPending } = useSession();
	const [creditBalance, setCreditBalance] = useState<number | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [newProjectName, setNewProjectName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const importInputRef = useRef<HTMLInputElement>(null);

	// Handle purchase redirect
	useEffect(() => {
		const purchased = searchParams.get("purchased");
		if (purchased) {
			trackEvent("purchase_completed", { pack: purchased });
			toast.success("Credits added! You're all set.");
			// Refresh credits
			fetch("/api/credits").then(r => r.json()).then(d => setCreditBalance(d.balance ?? 0)).catch(() => {});
			// Clean URL
			router.replace("/dashboard");
		}
	}, [searchParams, router]);

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
				<div className="flex flex-col items-center gap-4">
					<div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-[0_0_20px_hsl(262_83%_58%/0.3)]">
						<Sparkles className="h-5 w-5 text-white animate-pulse" />
					</div>
					<p className="text-muted-foreground text-sm">Loading your workspace...</p>
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
			if (resp.ok) {
					trackEvent("project_created");
					router.push(`/editor/${id}?name=${encodeURIComponent(newProjectName.trim())}`);
				}
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

	function handleImportClick() {
		importInputRef.current?.click();
	}

	async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			if (data.projects && Array.isArray(data.projects)) {
				for (const project of data.projects) {
					await fetch("/api/projects", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ id: project.id || crypto.randomUUID(), name: project.name }),
					});
				}
				// Refresh project list
				const resp = await fetch("/api/projects");
				const refreshed = await resp.json();
				setProjects(refreshed.projects || []);
			}
		} catch {
			// silently ignore bad files
		}
		// Reset input so the same file can be re-imported
		if (importInputRef.current) importInputRef.current.value = "";
	}

	const remaining = creditBalance ?? 0;
	const isLowCredits = remaining < 10;
	const firstName = session.user.name?.split(" ")[0];

	const quickActions = [
		{
			label: "New Video",
			icon: <Plus className="h-4 w-4" />,
			gradient: "from-violet-500 to-fuchsia-500",
			onClick: () => { setShowCreate(true); setNewProjectName(""); },
		},
		{
			label: "Import Project",
			icon: <Upload className="h-4 w-4" />,
			gradient: "from-cyan-500 to-blue-500",
			onClick: handleImportClick,
		},
		{
			label: "Watch Tutorial",
			icon: <Play className="h-4 w-4" />,
			gradient: "from-emerald-500 to-green-500",
			href: "https://www.youtube.com/@vibeedit",
			external: true,
		},
		{
			label: "Buy Credits",
			icon: <CreditCard className="h-4 w-4" />,
			gradient: "from-amber-500 to-orange-500",
			href: "/pricing",
		},
	];

	const examplePrompts = [
		"Add my intro clip as the main video",
		"Cut the first 3 seconds and add a fade in",
		"Overlay background music at 50% volume",
	];

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Hidden file input for import */}
			<input
				ref={importInputRef}
				type="file"
				accept=".json,.vibeedit"
				className="hidden"
				onChange={handleImportFile}
			/>

			{/* ── Gradient background ─────────────────────────── */}
			<div className="fixed inset-0 pointer-events-none">
				<div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-600/[0.07] via-purple-600/[0.04] to-transparent blur-[100px]" />
				<div className="absolute -bottom-[30%] -right-[15%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-fuchsia-600/[0.05] via-pink-600/[0.03] to-transparent blur-[100px]" />
			</div>

			{/* ── Top bar ─────────────────────────────────────── */}
			<header className="sticky top-0 z-50">
				<div className="mx-auto max-w-6xl px-6 py-3">
					<div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/30 backdrop-blur-2xl px-5 py-2.5 shadow-lg">
						<Link href="/" className="flex items-center gap-2.5">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_12px_hsl(262_83%_58%/0.3)]">
								<Sparkles className="h-4 w-4 text-white" />
							</div>
							<span className="text-base font-bold tracking-tight font-[family-name:var(--font-display)] text-white">
								VibeEdit
							</span>
						</Link>

						<div className="flex items-center gap-2">
							<Link
								href="/pricing"
								className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
									isLowCredits
										? "bg-red-500/15 text-red-400 border border-red-500/20"
										: "bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
								}`}
							>
								<Coins className="h-3 w-3" />
								{creditBalance === null ? "..." : remaining}
							</Link>
							<Link href="/settings" className="rounded-full p-2 text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200">
								<Settings className="h-4 w-4" />
							</Link>
							<button
								onClick={() => signOut().then(() => router.push("/"))}
								className="rounded-full p-2 text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200"
							>
								<LogOut className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* ── Main content ────────────────────────────────── */}
			<main className="relative mx-auto max-w-6xl px-6 py-10">
				{/* Welcome + Actions */}
				<motion.div
					className="flex items-end justify-between mb-4"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
				>
					<div>
						<h1 className="text-4xl font-extrabold tracking-tight font-[family-name:var(--font-display)]">
							{firstName ? (
								<>Hey, <span className="gradient-text">{firstName}</span></>
							) : (
								"Your Projects"
							)}
						</h1>
						<p className="mt-2 text-muted-foreground">
							{projects.length > 0 ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : "Create your first project to get started"}
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={handleBackup}
							className="rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border/30 hover:border-border/50 hover:bg-card/40 transition-all duration-200"
						>
							<Download className="h-3.5 w-3.5 inline mr-1.5" />
							Backup
						</button>
						{!showCreate && (
							<button
								onClick={() => { setShowCreate(true); setNewProjectName(""); }}
								className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_hsl(262_83%_58%/0.25)] hover:shadow-[0_0_35px_hsl(262_83%_58%/0.4)] transition-all duration-300"
							>
								<Plus className="h-4 w-4" />
								New Project
								<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
							</button>
						)}
					</div>
				</motion.div>

				{/* ── Stats bar ───────────────────────────────────── */}
				<motion.div
					className="flex items-center gap-3 mb-8 text-xs text-muted-foreground/70"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					<span className="flex items-center gap-1.5">
						<FolderPlus className="h-3 w-3" />
						{projects.length} project{projects.length === 1 ? "" : "s"}
					</span>
					<span className="text-border/50">|</span>
					<span className="flex items-center gap-1.5">
						<Coins className="h-3 w-3" />
						{creditBalance === null ? "..." : remaining} credits remaining
					</span>
					<span className="text-border/50">|</span>
					<span className="flex items-center gap-1.5">
						<Calendar className="h-3 w-3" />
						Member since {memberSince((session.user as Record<string, unknown>).createdAt as string | null | undefined)}
					</span>
				</motion.div>

				{/* ── Quick Actions Row ───────────────────────────── */}
				<motion.div
					className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.15 }}
				>
					{quickActions.map((action) => {
						const inner = (
							<motion.div
								className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.06] hover:border-white/[0.1]"
								whileHover={{ y: -2 }}
								transition={{ duration: 0.2 }}
							>
								<div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${action.gradient} shadow-sm`}>
									{action.icon}
								</div>
								<span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
									{action.label}
								</span>
							</motion.div>
						);

						if (action.href && action.external) {
							return (
								<a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer">
									{inner}
								</a>
							);
						}
						if (action.href) {
							return (
								<Link key={action.label} href={action.href}>
									{inner}
								</Link>
							);
						}
						return (
							<div key={action.label} onClick={action.onClick}>
								{inner}
							</div>
						);
					})}
				</motion.div>

				{/* Create project inline */}
				{showCreate && (
					<motion.div
						className="mb-8 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-5"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						transition={{ duration: 0.3 }}
					>
						<p className="text-sm font-semibold font-[family-name:var(--font-display)] mb-3">Create a new project</p>
						<div className="flex items-center gap-3">
							<input
								type="text"
								value={newProjectName}
								onChange={(e) => setNewProjectName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreate()}
								placeholder="My awesome video..."
								autoFocus
								className="flex-1 rounded-xl border border-border/30 bg-background/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-muted-foreground/50"
							/>
							<button
								onClick={handleCreate}
								disabled={!newProjectName.trim() || isCreating}
								className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-6 py-3 text-sm font-semibold hover:shadow-[0_0_20px_hsl(262_83%_58%/0.3)] disabled:opacity-50 transition-all duration-200"
							>
								{isCreating ? "Creating..." : "Create"}
							</button>
							<button
								onClick={() => setShowCreate(false)}
								className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
							>
								Cancel
							</button>
						</div>
					</motion.div>
				)}

				{/* Projects grid */}
				{projects.length === 0 ? (
					<motion.div
						className="rounded-3xl border border-dashed border-border/30 py-24 text-center relative overflow-hidden"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.1 }}
					>
						{/* Subtle gradient bg */}
						<div className="absolute inset-0 bg-gradient-to-b from-card/20 to-card/40" />
						<div className="relative flex flex-col items-center gap-5">
							<div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_40px_hsl(262_83%_58%/0.25)]">
								<Video className="h-9 w-9 text-white" />
							</div>
							<div>
								<h3 className="text-2xl font-bold font-[family-name:var(--font-display)]">
									Create your first video
								</h3>
								<p className="text-muted-foreground mt-2 max-w-sm mx-auto">
									Upload media, describe your edit in plain English, and let AI do the rest.
								</p>
							</div>
							<button
								onClick={() => { setShowCreate(true); setNewProjectName(""); }}
								className="group mt-2 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300"
							>
								<Sparkles className="h-4 w-4" />
								New Project
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</button>

							{/* Example prompts */}
							<div className="mt-6 flex flex-col items-center gap-2.5 max-w-md">
								<p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
									Try saying
								</p>
								{examplePrompts.map((prompt) => (
									<div
										key={prompt}
										className="flex items-center gap-2 rounded-full border border-border/20 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground/80"
									>
										<Sparkles className="h-3 w-3 text-violet-400/60 shrink-0" />
										<span className="italic">&ldquo;{prompt}&rdquo;</span>
									</div>
								))}
							</div>
						</div>
					</motion.div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{projects.map((project, i) => {
							const grad = projectGradient(project.name);
							return (
								<motion.div
									key={project.id}
									className="group relative rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden transition-colors hover:border-primary/20"
									initial={{ opacity: 0, y: 16 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
									whileHover={{
										y: -3,
										boxShadow: "0 12px 40px hsl(262 83% 58% / 0.08), 0 2px 8px rgba(0,0,0,0.06)",
									}}
								>
									{/* Color banner */}
									<div className={`h-1.5 w-full bg-gradient-to-r ${grad} opacity-60 group-hover:opacity-100 transition-opacity`} />

									{/* Film strip decoration */}
									<div className="absolute top-1.5 right-0 h-full w-6 opacity-0 group-hover:opacity-[0.04] transition-opacity pointer-events-none">
										{Array.from({ length: 8 }).map((_, idx) => (
											<div key={idx} className="w-3 h-2 bg-white rounded-[1px] ml-1.5 mb-1" />
										))}
									</div>

									<Link href={`/editor/${project.id}`} className="block p-5">
										<div className="flex items-start justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2.5 mb-1">
													<div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${grad} shadow-sm`}>
														<Film className="h-3.5 w-3.5 text-white" />
													</div>
													<h3 className="text-sm font-semibold truncate font-[family-name:var(--font-display)]">
														{project.name}
													</h3>
												</div>
												<div className="ml-[42px] flex items-center gap-2">
													<p className="text-[11px] text-muted-foreground/70 font-medium">
														Edited {timeAgo(project.updatedAt || project.createdAt)}
													</p>
												</div>
											</div>
											{/* "Open" text that slides in on hover */}
											<div className="flex items-center gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0 mt-1">
												<span className="text-xs font-medium text-primary/80">Open</span>
												<ArrowRight className="h-3 w-3 text-primary/80" />
											</div>
										</div>
									</Link>

									{/* Delete */}
									<div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
										{deleteConfirm === project.id ? (
											<div className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-full px-1.5 py-1 border border-border/30 shadow-sm">
												<button
													onClick={() => handleDelete(project.id)}
													className="rounded-full px-2.5 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
												>
													Delete
												</button>
												<button
													onClick={() => setDeleteConfirm(null)}
													className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 transition-colors"
												>
													No
												</button>
											</div>
										) : (
											<button
												onClick={() => setDeleteConfirm(project.id)}
												className="rounded-full p-1.5 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
								</motion.div>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
