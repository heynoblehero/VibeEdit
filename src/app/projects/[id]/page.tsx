"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ProjectShell } from "@/components/editor/ProjectShell";
import { useProjectStore } from "@/store/project-store";

/**
 * /projects/[id] — switches the active project to the one in the URL,
 * then renders the editor shell. Falls back to /dashboard when the id
 * isn't in the projects map (deep link to a deleted project).
 *
 * In Next 16 the params prop is a Promise; unwrap with React.use().
 */
export default function ProjectPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();
	const projects = useProjectStore((s) => s.projects);
	const activeId = useProjectStore((s) => s.project.id);
	const switchProject = useProjectStore((s) => s.switchProject);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		// Project store hydrates from localStorage on the client. Wait one
		// frame so we read the real projects map, not the SSR default.
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		if (!projects[id]) {
			router.replace("/dashboard");
			return;
		}
		if (activeId !== id) switchProject(id);
	}, [hydrated, id, projects, activeId, switchProject, router]);

	if (!hydrated || !projects[id]) {
		return (
			<div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-500 text-sm">
				Loading project…
			</div>
		);
	}

	return <ProjectShell />;
}
