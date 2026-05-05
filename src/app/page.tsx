"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";

/**
 * Root route. Redirects either:
 *   - to the last-active project's editor (`/projects/<id>`) when one
 *     exists in the local store, or
 *   - to `/dashboard` for anyone without a current project.
 *
 * Why a client redirect instead of next.config rewrite: the routing
 * decision depends on Zustand-persisted localStorage state, which only
 * exists in the browser. SSR has no idea which project to open.
 */
export default function Home() {
	const router = useRouter();
	const project = useProjectStore((s) => s.project);
	const projectsMap = useProjectStore((s) => s.projects);

	useEffect(() => {
		const hasProjects = Object.keys(projectsMap).length > 0;
		const target = hasProjects && project?.id
			? `/projects/${project.id}`
			: "/dashboard";
		router.replace(target);
	}, [project?.id, projectsMap, router]);

	return (
		<div
			className="flex items-center justify-center h-screen text-neutral-500 text-sm"
			style={{ background: "#0a0a0a" }}
		>
			Loading…
		</div>
	);
}
