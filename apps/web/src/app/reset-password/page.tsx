"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function ResetPasswordPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");
	const errorParam = searchParams.get("error");

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(
		errorParam === "INVALID_TOKEN"
			? "This reset link is invalid or has expired."
			: ""
	);
	const [success, setSuccess] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		if (newPassword.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		if (!token) {
			setError("Missing reset token.");
			return;
		}

		setLoading(true);

		try {
			const result = await authClient.resetPassword({
				newPassword,
				token,
			});
			if (result.error) {
				setError(
					result.error.message || "Failed to reset password."
				);
			} else {
				setSuccess(true);
				setTimeout(() => router.push("/login"), 2000);
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	if (!token && !errorParam) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl font-bold">
							Invalid Link
						</CardTitle>
						<CardDescription>
							This password reset link is invalid or has
							expired.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Link
							href="/forgot-password"
							className="text-primary underline underline-offset-4 hover:text-primary/80 text-sm"
						>
							Request a new reset link
						</Link>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">
						Reset your password
					</CardTitle>
					<CardDescription>
						Enter your new password below
					</CardDescription>
				</CardHeader>
				{success ? (
					<CardContent className="space-y-4">
						<div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
							Password reset successfully! Redirecting to
							login...
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
								<Label htmlFor="newPassword">
									New password
								</Label>
								<Input
									id="newPassword"
									type="password"
									placeholder="Enter new password"
									value={newPassword}
									onChange={(e) =>
										setNewPassword(e.target.value)
									}
									required
									autoComplete="new-password"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="confirmPassword">
									Confirm password
								</Label>
								<Input
									id="confirmPassword"
									type="password"
									placeholder="Confirm new password"
									value={confirmPassword}
									onChange={(e) =>
										setConfirmPassword(e.target.value)
									}
									required
									autoComplete="new-password"
								/>
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-4">
							<Button
								type="submit"
								className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={loading || !!errorParam}
							>
								{loading
									? "Resetting..."
									: "Reset Password"}
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
