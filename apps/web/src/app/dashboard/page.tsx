"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth/client";

const placeholderProjects = [
	{ id: "1", name: "My Intro", updatedAt: "2 min ago" },
	{ id: "2", name: "Isaac Video", updatedAt: "yesterday" },
	{ id: "3", name: "Demo Reel", updatedAt: "3 days ago" },
];

export default function DashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [creditBalance, setCreditBalance] = useState<number | null>(null);

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
		}
	}, [session]);

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

	function handleNewProject() {
		const id = crypto.randomUUID();
		router.push(`/editor/${id}`);
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
						<button
							onClick={handleLogout}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
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
					<p className="mt-1 text-muted-foreground">Here is what is happening with your projects.</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Credit Balance */}
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-1">
						<h2 className="text-sm font-medium text-muted-foreground mb-4">Credit Balance</h2>
						<p className="text-3xl font-bold">
							{creditBalance === null ? "..." : remaining}
						</p>
						<p className="text-sm text-muted-foreground mt-1">credits remaining</p>

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
							<button
								onClick={handleNewProject}
								className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
							>
								+ New Project
							</button>
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
								<button
									onClick={handleNewProject}
									className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
								>
									+ New Project
								</button>
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
									<button
										onClick={handleNewProject}
										className="mt-2 inline-block text-sm text-primary font-medium hover:text-primary/80 transition-colors"
									>
										Create your first project
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
