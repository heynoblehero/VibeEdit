"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { signIn } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FloatingOrbs } from "@/components/ui/motion/floating-orbs";

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
				router.push(redirect);
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center gradient-hero-bg px-4">
			<FloatingOrbs />
			<motion.div
				initial={{ opacity: 0, y: 20, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
				className="relative z-10 w-full max-w-md"
			>
				<Card className="glass-strong rounded-2xl shadow-xl border-border/40">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl font-bold font-[family-name:var(--font-display)]">
							Welcome back
						</CardTitle>
						<CardDescription>Sign in to your VibeEdit account</CardDescription>
					</CardHeader>
					<form onSubmit={handleSubmit}>
						<CardContent className="space-y-4">
							{error && (
								<div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
									{error}
								</div>
							)}
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									placeholder="Enter your password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									showPassword={showPassword}
									onShowPasswordChange={setShowPassword}
									required
									autoComplete="current-password"
								/>
							</div>
							<div className="flex justify-end">
								<a
									href="/forgot-password"
									className="text-xs text-primary hover:underline"
								>
									Forgot password?
								</a>
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-4">
							<button
								type="submit"
								className="w-full gradient-primary text-white rounded-full py-3 text-sm font-semibold transition-all duration-200 hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
								disabled={loading}
							>
								{loading ? "Signing in..." : "Sign in"}
							</button>
							<p className="text-sm text-muted-foreground">
								Don&apos;t have an account?{" "}
								<Link
									href="/register"
									className="text-primary underline underline-offset-4 hover:text-primary/80"
								>
									Register
								</Link>
							</p>
						</CardFooter>
					</form>
				</Card>
			</motion.div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="flex min-h-screen items-center justify-center gradient-hero-bg"><p className="text-muted-foreground">Loading...</p></div>}>
			<LoginForm />
		</Suspense>
	);
}
