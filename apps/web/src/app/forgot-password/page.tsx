"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
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

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			await authClient.requestPasswordReset({
				email,
				redirectTo: "/reset-password",
			});
			setSent(true);
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">
						Forgot password
					</CardTitle>
					<CardDescription>
						Enter your email and we&apos;ll send you a reset link
					</CardDescription>
				</CardHeader>
				{sent ? (
					<CardContent className="space-y-4">
						<div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
							If an account exists with that email, a reset link
							has been sent.
						</div>
					</CardContent>
				) : (
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
						</CardContent>
						<CardFooter className="flex flex-col gap-4">
							<Button
								type="submit"
								className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={loading}
							>
								{loading
									? "Sending..."
									: "Send Reset Link"}
							</Button>
						</CardFooter>
					</form>
				)}
				<CardFooter className="justify-center">
					<p className="text-sm text-muted-foreground">
						<Link
							href="/login"
							className="text-primary underline underline-offset-4 hover:text-primary/80"
						>
							Back to login
						</Link>
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
