"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirect = searchParams.get("redirect") || "/dashboard";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await signIn.email({ email, password });
			if (result.error) {
				setError(result.error.message || "Invalid email or password");
			} else {
				trackEvent("login");
				router.push(redirect);
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-[#08080c] flex items-center justify-center px-4 relative overflow-hidden">
			{/* BG blobs */}
			<div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-violet-600/15 blur-[100px]" />
			<div className="absolute -bottom-[20%] -right-[15%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[100px]" />

			<div className="relative z-10 w-full max-w-md">
				{/* Logo */}
				<div className="flex items-center justify-center gap-2.5 mb-8">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_20px_hsl(262_83%_58%/0.3)]">
						<Sparkles className="h-5 w-5 text-white" />
					</div>
					<span className="text-xl font-bold font-[family-name:var(--font-display)] text-white">VibeEdit</span>
				</div>

				{/* Card */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8">
					<div className="text-center mb-6">
						<h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-white">Welcome back</h1>
						<p className="text-sm text-white/50 mt-1">Sign in to your account</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
								{error}
							</div>
						)}
						<div className="space-y-2">
							<Label htmlFor="email" className="text-white/70 text-sm font-medium">Email</Label>
							<Input
								id="email" type="email" placeholder="you@example.com"
								value={email} onChange={(e) => setEmail(e.target.value)}
								required autoComplete="email"
								className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-11"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password" className="text-white/70 text-sm font-medium">Password</Label>
							<Input
								id="password" type="password" placeholder="Enter your password"
								value={password} onChange={(e) => setPassword(e.target.value)}
								showPassword={showPassword} onShowPasswordChange={setShowPassword}
								required autoComplete="current-password"
								className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-11"
							/>
						</div>
						<div className="flex justify-end">
							<a href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">Forgot password?</a>
						</div>
						<button
							type="submit" disabled={loading}
							className="w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-bold text-white hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] disabled:opacity-50 transition-all duration-200 mt-2"
						>
							{loading ? "Signing in..." : "Sign in"}
						</button>
					</form>

					<p className="text-sm text-white/40 text-center mt-6">
						Don&apos;t have an account?{" "}
						<Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium">Register</Link>
					</p>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#08080c]"><p className="text-white/40">Loading...</p></div>}>
			<LoginForm />
		</Suspense>
	);
}
