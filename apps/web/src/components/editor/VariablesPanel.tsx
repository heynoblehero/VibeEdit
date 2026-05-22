"use client";

import { useEffect, useState } from "react";

type Variable = {
	key: string;
	type: "string" | "number" | "color" | "boolean";
	defaultValue: string;
	currentValue: string;
};

// Parses data-composition-variables off the root element.
// Format examples we support:
//   { "title": "Hello", "accent": "#ff0", "count": 3, "enabled": true }
function parseVariables(html: string): Variable[] {
	const match = html.match(/data-composition-variables\s*=\s*(["'])([\s\S]*?)\1/);
	if (!match) return [];
	const decoded = match[2]
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
	try {
		const parsed = JSON.parse(decoded) as Record<string, unknown>;
		return Object.entries(parsed).map(([key, value]) => ({
			key,
			type: detectType(value),
			defaultValue: String(value),
			currentValue: String(value),
		}));
	} catch {
		return [];
	}
}

function detectType(v: unknown): Variable["type"] {
	if (typeof v === "boolean") return "boolean";
	if (typeof v === "number") return "number";
	if (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v))
		return "color";
	return "string";
}

export function VariablesPanel({
	projectId,
	reloadKey,
}: {
	projectId: string;
	reloadKey: number;
}) {
	const [vars, setVars] = useState<Variable[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/projects/${projectId}/file?path=index.html`)
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (!j) return setVars([]);
				const parsed = parseVariables(j.content);
				setVars(parsed);
				setError(null);
			})
			.catch((err) => setError((err as Error).message));
	}, [projectId, reloadKey]);

	function setValue(key: string, value: string) {
		setVars((prev) =>
			prev.map((v) => (v.key === key ? { ...v, currentValue: value } : v)),
		);
	}

	if (error) return null;
	if (vars.length === 0) return null;

	return (
		<div className="border-b border-[var(--color-border)] p-3">
			<div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
				Variables
			</div>
			<div className="space-y-2">
				{vars.map((v) => (
					<div key={v.key} className="text-xs">
						<label className="mb-0.5 block text-[var(--color-fg-muted)]">
							{v.key}
						</label>
						<VarInput
							v={v}
							onChange={(value) => setValue(v.key, value)}
						/>
					</div>
				))}
			</div>
			<p className="mt-3 text-[10px] text-[var(--color-fg-muted)]">
				Local preview only · Ask the agent to persist these.
			</p>
		</div>
	);
}

function VarInput({
	v,
	onChange,
}: {
	v: Variable;
	onChange: (value: string) => void;
}) {
	if (v.type === "color") {
		return (
			<div className="flex items-center gap-2">
				<input
					type="color"
					value={v.currentValue}
					onChange={(event) => onChange(event.target.value)}
					className="h-7 w-10 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
				/>
				<input
					value={v.currentValue}
					onChange={(event) => onChange(event.target.value)}
					className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono"
				/>
			</div>
		);
	}
	if (v.type === "boolean") {
		return (
			<label className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={v.currentValue === "true"}
					onChange={(event) => onChange(String(event.target.checked))}
				/>
				<span>{v.currentValue}</span>
			</label>
		);
	}
	return (
		<input
			value={v.currentValue}
			onChange={(event) => onChange(event.target.value)}
			className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1"
		/>
	);
}
