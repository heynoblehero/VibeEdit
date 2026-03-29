"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { signUp } from "@/lib/auth/client";
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
import { NeonBadge } from "@/components/ui/motion/neon-badge";

export default function RegisterPage() {
	const router = useRouter();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setLoading(true);

		try {
			const result = await signUp.email({ email, password, name });
			if (result.error) {
				setError(result.error.message || "Registration failed");
			} else {
				// Create initial credit record
				const initResp = await fetch("/api/auth/credits/init", { method: "POST" });
				if (!initResp.ok) {
					console.error("Failed to init credits");
				}
				router.push("/dashboard");
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center gradient-hero-bg px-4 py-12">
			<FloatingOrbs />
			<motion.div
				initial={{ opacity: 0, y: 20, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
				className="relative z-10 w-full max-w-md"
			>
				<Card className="glass-strong rounded-2xl shadow-xl border-border/40">
					<CardHeader className="text-center">
						<div className="flex justify-center mb-3">
							<NeonBadge variant="lime">10 free credits on signup</NeonBadge>
						</div>
						<CardTitle className="text-2xl font-bold font-[family-name:var(--font-display)]">
							Create an account
						</CardTitle>
						<CardDescription>
							Get started with VibeEdit — your AI video editor
						</CardDescription>
					</CardHeader>
					<form onSubmit={handleSubmit}>
						<CardContent className="space-y-4">
							{error && (
								<div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
									{error}
								</div>
							)}
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									type="text"
									placeholder="Your name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
									autoComplete="name"
								/>
							</div>
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
									placeholder="At least 8 characters"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									showPassword={showPassword}
									onShowPasswordChange={setShowPassword}
									required
									autoComplete="new-password"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm Password</Label>
								<Input
									id="confirmPassword"
									type="password"
									placeholder="Repeat your password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									showPassword={showConfirmPassword}
									onShowPasswordChange={setShowConfirmPassword}
									required
									autoComplete="new-password"
								/>
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-4">
							<button
								type="submit"
								className="w-full gradient-primary text-white rounded-full py-3 text-sm font-semibold transition-all duration-200 hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
								disabled={loading}
							>
								{loading ? "Creating account..." : "Create account"}
							</button>
							<p className="text-sm text-muted-foreground">
								Already have an account?{" "}
								<Link
									href="/login"
									className="text-primary underline underline-offset-4 hover:text-primary/80"
								>
									Sign in
								</Link>
							</p>
						</CardFooter>
					</form>
				</Card>
			</motion.div>
		</div>
	);
}
