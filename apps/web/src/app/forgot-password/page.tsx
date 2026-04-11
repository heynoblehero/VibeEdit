"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function ForgotPasswordPage() {
	return (
		<div className="min-h-screen bg-[#08080c] flex items-center justify-center px-4 relative overflow-hidden">
			<div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-violet-600/15 blur-[100px]" />
			<div className="absolute -bottom-[20%] -right-[15%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[100px]" />

			<div className="relative z-10 w-full max-w-md">
				<div className="flex items-center justify-center gap-2.5 mb-8">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_20px_hsl(262_83%_58%/0.3)]">
						<Sparkles className="h-5 w-5 text-white" />
					</div>
					<span className="text-xl font-bold font-[family-name:var(--font-display)] text-white">VibeEdit</span>
				</div>

				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 text-center">
					<h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-white mb-2">Password Reset</h1>
					<p className="text-sm text-white/50 mb-6">
						Email-based password reset is not available yet.
						Contact support to reset your password.
					</p>
					<a
						href="mailto:support@vibevideoedit.com"
						className="inline-block rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-2.5 text-sm font-bold text-white hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] transition-all duration-200 mb-4"
					>
						Contact Support
					</a>
					<p className="text-sm text-white/40">
						<Link href="/login" className="text-violet-400 hover:text-violet-300">
							Back to login
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
