"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

interface AnimatedCounterProps {
	value: number;
	prefix?: string;
	suffix?: string;
	className?: string;
	duration?: number;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", className, duration = 1.5 }: AnimatedCounterProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const isInView = useInView(ref, { once: true });
	const [displayed, setDisplayed] = useState(0);

	useEffect(() => {
		if (!isInView) return;
		const start = Date.now();
		const tick = () => {
			const elapsed = Date.now() - start;
			const progress = Math.min(elapsed / (duration * 1000), 1);
			// Ease out cubic
			const eased = 1 - Math.pow(1 - progress, 3);
			setDisplayed(Math.round(eased * value));
			if (progress < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}, [isInView, value, duration]);

	return (
		<motion.span
			ref={ref}
			className={className}
			initial={{ opacity: 0 }}
			animate={isInView ? { opacity: 1 } : {}}
		>
			{prefix}{displayed}{suffix}
		</motion.span>
	);
}
