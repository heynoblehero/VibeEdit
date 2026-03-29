"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Monitor, Sparkles } from "lucide-react";

const STORAGE_KEY = "mobile-acknowledged";

interface MobileGateProps {
	children: React.ReactNode;
}

export function MobileGate({ children }: MobileGateProps) {
	const router = useRouter();
	const [show, setShow] = useState<boolean | null>(null);

	useEffect(() => {
		const isMobile = window.innerWidth < 1024;
		const acknowledged = localStorage.getItem(STORAGE_KEY) === "true";
		setShow(isMobile && !acknowledged);
	}, []);

	if (show === null) return null;
	if (!show) return <>{children}</>;

	const handleContinue = () => {
		localStorage.setItem(STORAGE_KEY, "true");
		setShow(false);
	};

	const handleGoBack = () => {
		router.back();
	};

	return (
		<div className="dark bg-background relative flex h-screen w-screen flex-col overflow-hidden gradient-hero-bg">
			<button
				className="absolute top-6 left-6 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
				onClick={handleGoBack}
			>
				<ArrowLeft className="h-4 w-4" />
				Go back
			</button>

			<div className="flex flex-1 flex-col items-center justify-center gap-6 px-7 text-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-[0_0_30px_hsl(262_83%_58%/0.3)]">
					<Monitor className="h-8 w-8 text-white" />
				</div>

				<div className="flex flex-col gap-3 max-w-sm">
					<h1 className="text-foreground text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
						Desktop only (for now)
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						VibeEdit isn't optimized for mobile or iPad yet. Come back on a desktop for the full experience.
					</p>
				</div>

				<div className="flex items-center gap-3 mt-2">
					<button
						onClick={handleContinue}
						className="rounded-full gradient-primary px-6 py-2.5 text-sm font-semibold text-white hover:shadow-[0_0_20px_hsl(262_83%_58%/0.3)] transition-all duration-200 flex items-center gap-2"
					>
						<Sparkles className="h-4 w-4" />
						Take a look anyway
					</button>
					<Link
						href="/dashboard"
						className="rounded-full border border-border/40 px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 flex items-center gap-1.5"
					>
						Dashboard
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
				</div>
			</div>
		</div>
	);
}
