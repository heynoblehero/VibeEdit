"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";

export default function SignupPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const result = await signUp.email({ email, password, name });
		setBusy(false);
		if (result.error) {
			setError(result.error.message || "sign up failed");
			return;
		}
		router.push("/app/projects");
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
			<form
				onSubmit={submit}
				className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 p-6 sm:p-8"
			>
				<h1 className="text-2xl font-bold">Create account</h1>
				<input
					required
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Name"
					className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
				/>
				<input
					type="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					placeholder="Email"
					className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
				/>
				<input
					type="password"
					required
					minLength={6}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					placeholder="Password (6+ chars)"
					className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
				/>
				{error && <p className="text-sm text-red-400">{error}</p>}
				<button
					type="submit"
					disabled={busy}
					className="w-full rounded-md bg-[var(--color-accent)] py-2 font-semibold text-black disabled:opacity-50"
				>
					{busy ? "Creating..." : "Create account"}
				</button>
				<p className="text-sm text-neutral-400">
					Have an account?{" "}
					<Link href="/app/login" className="underline">
						Sign in
					</Link>
				</p>
			</form>
		</main>
	);
}
