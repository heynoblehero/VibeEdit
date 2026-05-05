"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { type AccentName } from "@/lib/design/tokens";

interface Props {
	/** Used to identify which workspace blew up in the fallback copy. */
	label: string;
	accent?: AccentName;
	children: ReactNode;
}

interface State {
	error: Error | null;
}

/**
 * Crash boundary scoped to a single workspace (Video / Audio / Animate).
 * A bad scene shouldn't blank the whole app — we localize the failure
 * and offer a one-click reset that re-mounts the subtree, plus a copy
 * of the stack the user can paste into a bug report.
 *
 * We don't ship an external reporter from here yet; surface the error
 * locally and trust the user / dev to act on it.
 */
export class WorkspaceErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// Log with workspace label so the console trace makes sense.
		console.error(`[${this.props.label}] crashed`, error, info.componentStack);
	}

	private reset = () => {
		this.setState({ error: null });
	};

	render() {
		if (!this.state.error) return this.props.children;
		const accent = this.props.accent ?? "video";
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="max-w-md w-full rounded-xl border border-red-500/30 bg-neutral-900/80 p-5 space-y-3 motion-pop">
					<div className="flex items-center gap-2 text-red-300">
						<AlertTriangle className="h-4 w-4" />
						<span className="text-[12px] uppercase tracking-wider font-semibold">
							{this.props.label} crashed
						</span>
					</div>
					<p className="text-[13px] text-neutral-200 leading-relaxed">
						Something in this workspace threw an exception. The rest of the app
						is still safe — your project is intact in localStorage.
					</p>
					<details className="text-[11px] text-neutral-500 font-mono">
						<summary className="cursor-pointer hover:text-neutral-300">
							Stack trace
						</summary>
						<pre className="mt-2 p-2 rounded bg-neutral-950 border border-neutral-800 overflow-auto max-h-48 whitespace-pre-wrap break-all">
							{this.state.error.message}
							{"\n\n"}
							{this.state.error.stack}
						</pre>
					</details>
					<div className="flex items-center gap-2 pt-1">
						<Button
							variant="primary"
							accent={accent}
							size="sm"
							leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
							onClick={this.reset}
						>
							Try again
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => window.location.reload()}
						>
							Reload page
						</Button>
					</div>
				</div>
			</div>
		);
	}
}
