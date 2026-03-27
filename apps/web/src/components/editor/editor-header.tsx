"use client";

import { useRef, useState } from "react";
import { ExportButton } from "./export-button";
import { ThemeToggle } from "../theme-toggle";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";

interface EditorHeaderProps {
	advancedView: boolean;
	onToggleAdvanced: () => void;
}

export function EditorHeader({ advancedView, onToggleAdvanced }: EditorHeaderProps) {
	return (
		<header className="flex h-[3.4rem] items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 pt-0.5">
			<div className="flex items-center gap-2">
				<BrandMark />
				<span className="text-stone-300 dark:text-stone-600 text-sm">/</span>
				<EditableProjectName />
			</div>
			<nav className="flex items-center gap-2">
				<button
					onClick={onToggleAdvanced}
					className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
						advancedView
							? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
							: "text-stone-500 hover:text-stone-700 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
					}`}
				>
					{advancedView ? "Simple View" : "Advanced"}
				</button>
				<ExportButton />
				<ThemeToggle />
			</nav>
		</header>
	);
}

function BrandMark() {
	return (
		<span className="text-sm font-bold tracking-tight text-stone-800 dark:text-stone-200">VibeEdit</span>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName = activeProject?.metadata.name || "";

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName,
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			inputRef.current?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (inputRef.current) {
				inputRef.current.value = originalNameRef.current;
			}
			setIsEditing(false);
			inputRef.current?.blur();
		}
	};

	return (
		<input
			ref={inputRef}
			type="text"
			defaultValue={projectName}
			readOnly={!isEditing}
			onClick={startEditing}
			onBlur={saveEdit}
			onKeyDown={handleKeyDown}
			style={{ fieldSizing: "content" }}
			className={cn(
				"text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isEditing && "ring-1 ring-ring cursor-text hover:bg-transparent",
			)}
		/>
	);
}
