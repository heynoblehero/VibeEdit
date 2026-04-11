"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Gift } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

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
			toast.error("Passwords do not match");
			return;
		}
		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			toast.error("Password must be at least 8 characters");
			return;
		}
		setLoading(true);
		try {
			const result = await signUp.email({ email, password, name });
			if (result.error) {
				const message = result.error.message || "Registration failed";
				setError(message);
				toast.error(message);
			} else {
				await fetch("/api/auth/credits/init", { method: "POST" }).catch(() => {});
				trackEvent("signup");
				toast.success("Account created! You got 10 free credits.");
				router.refresh();
				router.push("/dashboard");
			}
		} catch {
			const message = "Something went wrong. Please try again.";
			setError(message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	}

	const inputCls = "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-11";

	return (
		<div className="min-h-screen bg-[#08080c] flex items-center justify-center px-4 py-12 relative overflow-hidden">
			<div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-violet-600/15 blur-[100px]" />
			<div className="absolute -bottom-[20%] -right-[15%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[100px]" />

			<div className="relative z-10 w-full max-w-md">
				{/* Logo */}
				<div className="flex items-center justify-center gap-2.5 mb-6">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_20px_hsl(262_83%_58%/0.3)]">
						<Sparkles className="h-5 w-5 text-white" />
					</div>
					<span className="text-xl font-bold font-[family-name:var(--font-display)] text-white">VibeEdit</span>
				</div>

				{/* Card */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8">
					{/* Free credits badge */}
					<div className="flex justify-center mb-4">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
							<Gift className="h-3 w-3" /> 10 free credits on signup
						</span>
					</div>

					<div className="text-center mb-6">
						<h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-white">Create your account</h1>
						<p className="text-sm text-white/50 mt-1">Start editing videos with AI</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
						)}
						<div className="space-y-2">
							<Label htmlFor="name" className="text-white/70 text-sm font-medium">Name</Label>
							<Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={inputCls} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="email" className="text-white/70 text-sm font-medium">Email</Label>
							<Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="password" className="text-white/70 text-sm font-medium">Password</Label>
							<Input id="password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} showPassword={showPassword} onShowPasswordChange={setShowPassword} required autoComplete="new-password" className={inputCls} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword" className="text-white/70 text-sm font-medium">Confirm Password</Label>
							<Input id="confirmPassword" type="password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} showPassword={showConfirmPassword} onShowPasswordChange={setShowConfirmPassword} required autoComplete="new-password" className={inputCls} />
						</div>
						<button type="submit" disabled={loading} className="w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-bold text-white hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] disabled:opacity-50 transition-all duration-200 mt-2">
							{loading ? "Creating account..." : "Create account"}
						</button>
					</form>

					<p className="text-sm text-white/40 text-center mt-6">
						Already have an account?{" "}
						<Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
