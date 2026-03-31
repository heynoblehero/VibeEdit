"use client";

import { useEffect, useRef, useCallback } from "react";

// ---- Sparkle trail (hero section) ----

interface Spark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	size: number;
	color: string;
}

const COLORS = ["#a78bfa", "#d946ef", "#f472b6", "#818cf8", "#c084fc"];

export function SparkleCanvas({ className }: { className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sparks = useRef<Spark[]>([]);
	const mouseRef = useRef({ x: 0, y: 0 });
	const frameRef = useRef(0);
	const lastSpawn = useRef(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const resize = () => {
			const parent = canvas.parentElement;
			if (parent) {
				canvas.width = parent.clientWidth;
				canvas.height = parent.clientHeight;
			}
		};
		resize();
		window.addEventListener("resize", resize);

		const onMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

			const now = Date.now();
			if (now - lastSpawn.current > 50 && sparks.current.length < 15) {
				lastSpawn.current = now;
				sparks.current.push({
					x: mouseRef.current.x,
					y: mouseRef.current.y,
					vx: (Math.random() - 0.5) * 2,
					vy: (Math.random() - 0.5) * 2 - 1,
					life: 1,
					size: Math.random() * 3 + 1.5,
					color: COLORS[Math.floor(Math.random() * COLORS.length)],
				});
			}
		};
		canvas.addEventListener("mousemove", onMove);

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			sparks.current = sparks.current.filter((s) => {
				s.x += s.vx;
				s.y += s.vy;
				s.vy += 0.04; // gravity
				s.life -= 0.02;

				if (s.life <= 0) return false;

				ctx.beginPath();
				ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
				ctx.fillStyle = s.color;
				ctx.globalAlpha = s.life;
				ctx.fill();
				ctx.globalAlpha = 1;
				return true;
			});

			frameRef.current = requestAnimationFrame(draw);
		};
		frameRef.current = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(frameRef.current);
			window.removeEventListener("resize", resize);
			canvas.removeEventListener("mousemove", onMove);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className={`absolute inset-0 pointer-events-auto z-20 ${className ?? ""}`}
			style={{ mixBlendMode: "screen" }}
		/>
	);
}

// ---- Confetti burst (CTA click) ----

interface ConfettiPiece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	size: number;
	color: string;
	rotation: number;
	rotationSpeed: number;
}

export function useConfetti() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const pieces = useRef<ConfettiPiece[]>([]);
	const frameRef = useRef(0);
	const running = useRef(false);

	useEffect(() => {
		// Create a full-screen overlay canvas
		const canvas = document.createElement("canvas");
		canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999";
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		document.body.appendChild(canvas);
		canvasRef.current = canvas;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		window.addEventListener("resize", resize);

		return () => {
			cancelAnimationFrame(frameRef.current);
			window.removeEventListener("resize", resize);
			canvas.remove();
		};
	}, []);

	const burst = useCallback((originX: number, originY: number) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Spawn confetti
		for (let i = 0; i < 30; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 8 + 4;
			pieces.current.push({
				x: originX,
				y: originY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 4,
				life: 1,
				size: Math.random() * 6 + 3,
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
				rotation: Math.random() * 360,
				rotationSpeed: (Math.random() - 0.5) * 15,
			});
		}

		if (running.current) return;
		running.current = true;

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			pieces.current = pieces.current.filter((p) => {
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.25;
				p.vx *= 0.98;
				p.life -= 0.015;
				p.rotation += p.rotationSpeed;

				if (p.life <= 0) return false;

				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate((p.rotation * Math.PI) / 180);
				ctx.globalAlpha = p.life;
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				ctx.restore();
				return true;
			});

			if (pieces.current.length > 0) {
				frameRef.current = requestAnimationFrame(draw);
			} else {
				running.current = false;
			}
		};
		frameRef.current = requestAnimationFrame(draw);
	}, []);

	return burst;
}
