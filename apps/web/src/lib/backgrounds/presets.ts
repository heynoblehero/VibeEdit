export interface BackgroundPreset {
	id: string;
	name: string;
	category: "studio" | "office" | "nature" | "abstract" | "solid";
	/** For solid color backgrounds */
	color?: string;
	/** For CSS gradient backgrounds */
	gradient?: string;
	/** Canvas-based generator for complex backgrounds */
	generate?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Helper: seeded pseudo-random for reproducible procedural textures  */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

/* ------------------------------------------------------------------ */
/*  Helper: draw a radial vignette overlay                             */
/* ------------------------------------------------------------------ */

function drawVignette(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	strength: number = 0.6,
) {
	const cx = w / 2;
	const cy = h / 2;
	const radius = Math.max(w, h) * 0.7;
	const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
	gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
	gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------------------ */
/*  Helper: draw subtle noise texture                                  */
/* ------------------------------------------------------------------ */

function drawNoise(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	opacity: number = 0.03,
) {
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const rand = seededRandom(42);
	for (let i = 0; i < data.length; i += 4) {
		const noise = (rand() - 0.5) * 255 * opacity;
		data[i] = Math.max(0, Math.min(255, data[i] + noise));
		data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
		data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
	}
	ctx.putImageData(imageData, 0, 0);
}

/* ------------------------------------------------------------------ */
/*  Helper: draw soft bokeh circles                                    */
/* ------------------------------------------------------------------ */

function drawBokeh(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	color: string,
	count: number,
	seed: number = 123,
) {
	const rand = seededRandom(seed);
	ctx.globalCompositeOperation = "screen";
	for (let i = 0; i < count; i++) {
		const x = rand() * w;
		const y = rand() * h;
		const r = rand() * Math.min(w, h) * 0.08 + Math.min(w, h) * 0.02;
		const alpha = rand() * 0.12 + 0.03;
		const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
		gradient.addColorStop(0, color.replace(")", `, ${alpha})`).replace("rgb(", "rgba("));
		gradient.addColorStop(0.7, color.replace(")", `, ${alpha * 0.3})`).replace("rgb(", "rgba("));
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalCompositeOperation = "source-over";
}

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

export const backgroundPresets: BackgroundPreset[] = [
	/* ---- Studio ---- */
	{
		id: "professional-studio",
		name: "Professional Studio",
		category: "studio",
		generate(ctx, w, h) {
			// Dark charcoal with a centered top-down spotlight
			const bg = ctx.createLinearGradient(0, 0, 0, h);
			bg.addColorStop(0, "#3a3a3a");
			bg.addColorStop(0.4, "#2a2a2a");
			bg.addColorStop(1, "#1a1a1a");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Soft spotlight from top center
			const spot = ctx.createRadialGradient(w / 2, -h * 0.1, 0, w / 2, h * 0.3, h * 0.8);
			spot.addColorStop(0, "rgba(255, 255, 255, 0.12)");
			spot.addColorStop(0.4, "rgba(255, 255, 255, 0.04)");
			spot.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = spot;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.02);
			drawVignette(ctx, w, h, 0.4);
		},
	},
	{
		id: "photo-studio",
		name: "Photo Studio",
		category: "studio",
		generate(ctx, w, h) {
			// Clean white-to-light-gray seamless backdrop
			const bg = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, h * 0.9);
			bg.addColorStop(0, "#f8f8f8");
			bg.addColorStop(0.5, "#eeeeee");
			bg.addColorStop(1, "#d8d8d8");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Subtle floor shadow
			const floor = ctx.createLinearGradient(0, h * 0.6, 0, h);
			floor.addColorStop(0, "rgba(0, 0, 0, 0)");
			floor.addColorStop(1, "rgba(0, 0, 0, 0.06)");
			ctx.fillStyle = floor;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.015);
		},
	},
	{
		id: "warm-studio",
		name: "Warm Studio",
		category: "studio",
		generate(ctx, w, h) {
			// Warm beige-amber gradient
			const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, h * 0.95);
			bg.addColorStop(0, "#c4a882");
			bg.addColorStop(0.4, "#a08060");
			bg.addColorStop(1, "#6b5040");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Warm light bloom from upper-left
			const bloom = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, h * 0.6);
			bloom.addColorStop(0, "rgba(255, 220, 180, 0.15)");
			bloom.addColorStop(0.5, "rgba(255, 200, 150, 0.05)");
			bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = bloom;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.025);
			drawVignette(ctx, w, h, 0.45);
		},
	},

	/* ---- Office ---- */
	{
		id: "modern-office",
		name: "Modern Office",
		category: "office",
		generate(ctx, w, h) {
			// Light blue-gray gradient
			const bg = ctx.createLinearGradient(0, 0, w * 0.3, h);
			bg.addColorStop(0, "#e8edf2");
			bg.addColorStop(0.5, "#d5dce6");
			bg.addColorStop(1, "#c0c9d6");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Subtle geometric lines (like frosted glass partitions)
			ctx.strokeStyle = "rgba(180, 195, 215, 0.4)";
			ctx.lineWidth = 1;
			const rand = seededRandom(77);
			for (let i = 0; i < 8; i++) {
				const x = rand() * w;
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x + (rand() - 0.5) * w * 0.1, h);
				ctx.stroke();
			}
			for (let i = 0; i < 4; i++) {
				const y = rand() * h;
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(w, y + (rand() - 0.5) * h * 0.05);
				ctx.stroke();
			}

			// Soft window light from the right
			const light = ctx.createLinearGradient(w, 0, w * 0.5, h * 0.3);
			light.addColorStop(0, "rgba(255, 255, 255, 0.15)");
			light.addColorStop(1, "rgba(255, 255, 255, 0)");
			ctx.fillStyle = light;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.015);
		},
	},
	{
		id: "cozy-room",
		name: "Cozy Room",
		category: "office",
		generate(ctx, w, h) {
			// Warm brown gradient base
			const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.9);
			bg.addColorStop(0, "#8b7355");
			bg.addColorStop(0.5, "#6b5540");
			bg.addColorStop(1, "#4a3828");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Warm bokeh circles (like out-of-focus warm lights)
			drawBokeh(ctx, w, h, "rgb(255, 200, 120)", 25, 456);
			drawBokeh(ctx, w, h, "rgb(255, 180, 100)", 15, 789);

			drawNoise(ctx, w, h, 0.02);
			drawVignette(ctx, w, h, 0.5);
		},
	},

	/* ---- Nature ---- */
	{
		id: "nature-green",
		name: "Nature Green",
		category: "nature",
		generate(ctx, w, h) {
			// Green gradient base
			const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h);
			bg.addColorStop(0, "#5a8a50");
			bg.addColorStop(0.5, "#3d6b35");
			bg.addColorStop(1, "#2a4d25");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Blurred leaf-like ellipses
			ctx.globalCompositeOperation = "screen";
			const rand = seededRandom(321);
			for (let i = 0; i < 30; i++) {
				const x = rand() * w;
				const y = rand() * h;
				const rx = rand() * w * 0.06 + w * 0.02;
				const ry = rand() * h * 0.03 + h * 0.01;
				const angle = rand() * Math.PI;
				const alpha = rand() * 0.08 + 0.02;

				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(angle);
				const leafGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
				leafGrad.addColorStop(0, `rgba(120, 200, 80, ${alpha})`);
				leafGrad.addColorStop(1, "rgba(60, 140, 40, 0)");
				ctx.fillStyle = leafGrad;
				ctx.beginPath();
				ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			ctx.globalCompositeOperation = "source-over";

			// Sunlight filtering through
			const sun = ctx.createRadialGradient(w * 0.7, h * 0.15, 0, w * 0.7, h * 0.15, h * 0.5);
			sun.addColorStop(0, "rgba(255, 255, 200, 0.1)");
			sun.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = sun;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.02);
			drawVignette(ctx, w, h, 0.4);
		},
	},
	{
		id: "sunset",
		name: "Sunset",
		category: "nature",
		generate(ctx, w, h) {
			// Orange-to-purple gradient
			const bg = ctx.createLinearGradient(0, 0, 0, h);
			bg.addColorStop(0, "#1a0533");
			bg.addColorStop(0.25, "#4a1a6b");
			bg.addColorStop(0.5, "#c44a2f");
			bg.addColorStop(0.75, "#e88830");
			bg.addColorStop(1, "#f5c842");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Sun glow
			const glow = ctx.createRadialGradient(w / 2, h * 0.65, 0, w / 2, h * 0.65, h * 0.3);
			glow.addColorStop(0, "rgba(255, 220, 100, 0.25)");
			glow.addColorStop(0.5, "rgba(255, 150, 50, 0.1)");
			glow.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.02);
		},
	},
	{
		id: "ocean-blue",
		name: "Ocean Blue",
		category: "nature",
		generate(ctx, w, h) {
			// Deep blue gradient
			const bg = ctx.createLinearGradient(0, 0, 0, h);
			bg.addColorStop(0, "#0a1628");
			bg.addColorStop(0.3, "#122a50");
			bg.addColorStop(0.7, "#1a4080");
			bg.addColorStop(1, "#2060a8");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			// Wave-like curves with subtle highlights
			ctx.globalCompositeOperation = "screen";
			const rand = seededRandom(654);
			for (let i = 0; i < 6; i++) {
				const yBase = h * 0.3 + rand() * h * 0.5;
				const amplitude = h * 0.03 + rand() * h * 0.04;
				const frequency = 2 + rand() * 3;
				const alpha = 0.04 + rand() * 0.04;

				ctx.beginPath();
				ctx.moveTo(0, yBase);
				for (let x = 0; x <= w; x += 2) {
					const y = yBase + Math.sin((x / w) * Math.PI * frequency + i * 1.5) * amplitude;
					ctx.lineTo(x, y);
				}
				ctx.lineTo(w, h);
				ctx.lineTo(0, h);
				ctx.closePath();
				ctx.fillStyle = `rgba(80, 160, 255, ${alpha})`;
				ctx.fill();
			}
			ctx.globalCompositeOperation = "source-over";

			// Caustic light highlights
			const caustic = ctx.createRadialGradient(w * 0.4, h * 0.3, 0, w * 0.4, h * 0.3, h * 0.4);
			caustic.addColorStop(0, "rgba(100, 200, 255, 0.08)");
			caustic.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = caustic;
			ctx.fillRect(0, 0, w, h);

			drawNoise(ctx, w, h, 0.02);
			drawVignette(ctx, w, h, 0.5);
		},
	},

	/* ---- Abstract ---- */
	{
		id: "neon",
		name: "Neon",
		category: "abstract",
		generate(ctx, w, h) {
			// Dark base
			ctx.fillStyle = "#0a0a12";
			ctx.fillRect(0, 0, w, h);

			// Neon glow — magenta from left
			const magenta = ctx.createRadialGradient(0, h / 2, 0, 0, h / 2, w * 0.6);
			magenta.addColorStop(0, "rgba(255, 0, 150, 0.2)");
			magenta.addColorStop(0.3, "rgba(255, 0, 150, 0.08)");
			magenta.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = magenta;
			ctx.fillRect(0, 0, w, h);

			// Neon glow — cyan from right
			const cyan = ctx.createRadialGradient(w, h / 2, 0, w, h / 2, w * 0.6);
			cyan.addColorStop(0, "rgba(0, 200, 255, 0.2)");
			cyan.addColorStop(0.3, "rgba(0, 200, 255, 0.08)");
			cyan.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = cyan;
			ctx.fillRect(0, 0, w, h);

			// Neon glow — purple from bottom
			const purple = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.5);
			purple.addColorStop(0, "rgba(130, 50, 255, 0.15)");
			purple.addColorStop(0.4, "rgba(130, 50, 255, 0.05)");
			purple.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = purple;
			ctx.fillRect(0, 0, w, h);

			// Subtle scan lines
			ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
			for (let y = 0; y < h; y += 3) {
				ctx.fillRect(0, y, w, 1);
			}

			drawNoise(ctx, w, h, 0.03);
		},
	},
	{
		id: "gradient-mesh",
		name: "Gradient Mesh",
		category: "abstract",
		generate(ctx, w, h) {
			// Base: deep purple-blue
			ctx.fillStyle = "#1a103a";
			ctx.fillRect(0, 0, w, h);

			// Mesh blobs — overlapping soft colored circles
			ctx.globalCompositeOperation = "screen";

			// Teal blob — top-right
			const teal = ctx.createRadialGradient(w * 0.75, h * 0.2, 0, w * 0.75, h * 0.2, w * 0.4);
			teal.addColorStop(0, "rgba(0, 210, 190, 0.35)");
			teal.addColorStop(0.5, "rgba(0, 180, 160, 0.15)");
			teal.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = teal;
			ctx.fillRect(0, 0, w, h);

			// Pink blob — bottom-left
			const pink = ctx.createRadialGradient(w * 0.2, h * 0.8, 0, w * 0.2, h * 0.8, w * 0.45);
			pink.addColorStop(0, "rgba(255, 80, 160, 0.3)");
			pink.addColorStop(0.5, "rgba(255, 50, 130, 0.12)");
			pink.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = pink;
			ctx.fillRect(0, 0, w, h);

			// Orange blob — center
			const orange = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.35);
			orange.addColorStop(0, "rgba(255, 160, 40, 0.2)");
			orange.addColorStop(0.5, "rgba(255, 130, 20, 0.08)");
			orange.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = orange;
			ctx.fillRect(0, 0, w, h);

			// Blue blob — bottom-right
			const blue = ctx.createRadialGradient(w * 0.85, h * 0.65, 0, w * 0.85, h * 0.65, w * 0.3);
			blue.addColorStop(0, "rgba(60, 80, 255, 0.25)");
			blue.addColorStop(0.5, "rgba(40, 60, 220, 0.1)");
			blue.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = blue;
			ctx.fillRect(0, 0, w, h);

			ctx.globalCompositeOperation = "source-over";
			drawNoise(ctx, w, h, 0.02);
		},
	},

	/* ---- Solid ---- */
	{
		id: "minimal-white",
		name: "Minimal White",
		category: "solid",
		color: "#ffffff",
		generate(ctx, w, h) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, w, h);
		},
	},
	{
		id: "minimal-black",
		name: "Minimal Black",
		category: "solid",
		color: "#000000",
		generate(ctx, w, h) {
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, w, h);
		},
	},
];

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

export function getPresetById(id: string): BackgroundPreset | undefined {
	return backgroundPresets.find((p) => p.id === id);
}

export function getPresetsByCategory(
	category: BackgroundPreset["category"],
): BackgroundPreset[] {
	return backgroundPresets.filter((p) => p.category === category);
}

export const PRESET_CATEGORIES: {
	value: BackgroundPreset["category"];
	label: string;
}[] = [
	{ value: "studio", label: "Studio" },
	{ value: "office", label: "Office" },
	{ value: "nature", label: "Nature" },
	{ value: "abstract", label: "Abstract" },
	{ value: "solid", label: "Solid" },
];

/**
 * Render a preset to a canvas and return the canvas.
 * Useful for creating preview thumbnails or background textures.
 */
export function renderPresetToCanvas(
	preset: BackgroundPreset,
	width: number,
	height: number,
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;

	if (preset.generate) {
		preset.generate(ctx, width, height);
	} else if (preset.color) {
		ctx.fillStyle = preset.color;
		ctx.fillRect(0, 0, width, height);
	}

	return canvas;
}
