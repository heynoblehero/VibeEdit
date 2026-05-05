"use client";

import { cls } from "@/lib/design/tokens";

/**
 * Keyboard chord pill. Pass an array of keys (`["⌘", "K"]` or
 * `["Shift", "?"]`) and we render them with the right separator and
 * styling. Used in the shortcuts overlay and command palette.
 */
export function Kbd({
	keys,
	className,
}: {
	keys: string[];
	className?: string;
}) {
	return (
		<span className={cls("inline-flex items-center gap-0.5", className)}>
			{keys.map((k, i) => (
				<kbd
					key={`${k}-${i}`}
					className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-neutral-700 bg-neutral-900 text-[10px] font-mono text-neutral-300 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
				>
					{k}
				</kbd>
			))}
		</span>
	);
}

/**
 * Detects mac so we can use ⌘ vs Ctrl in shortcut labels at runtime.
 */
export function modKey(): string {
	if (typeof navigator === "undefined") return "Ctrl";
	return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}
