/**
 * Canvas renderer for autoresearch eval.
 * Uses @napi-rs/canvas to render Canvas 2D code outside the browser.
 * Mirrors the executor.ts rendering logic exactly.
 *
 * DO NOT MODIFY THIS FILE — it is part of the fixed eval harness.
 */

import { createCanvas } from "@napi-rs/canvas";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { validateUserCode } from "../apps/web/src/lib/ai/code-validator";

export interface RenderResult {
	success: boolean;
	pngPath?: string;
	base64?: string;
	error?: string;
}

export async function renderCanvasCode(opts: {
	color?: string;
	code?: string;
	width?: number;
	height?: number;
	outputPath: string;
}): Promise<RenderResult> {
	const { color, code, width = 1920, height = 1080, outputPath } = opts;

	if (!color && !code) {
		return { success: false, error: "No color or code provided" };
	}

	// Validate code safety (same validator as production)
	if (code) {
		const violation = validateUserCode(code);
		if (violation) {
			return { success: false, error: `Security: ${violation}` };
		}
	}

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");

	// Apply solid color base (same as executor.ts)
	if (color) {
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, width, height);
	}

	// Execute drawing code (mirrors executor.ts lines 266-289)
	if (code) {
		try {
			const trimmed = code.trim();
			const isFunctionExpr = /^\s*(\(|function[\s(])/.test(trimmed);
			const userCode = isFunctionExpr
				? `var __fn = (${trimmed}); __fn(ctx, width, height);`
				: code;

			const drawFn = new Function(
				"ctx",
				"width",
				"height",
				`"use strict";
				 var fetch = void 0, XMLHttpRequest = void 0, WebSocket = void 0;
				 var localStorage = void 0, sessionStorage = void 0;
				 var importScripts = void 0;
				 ${userCode}`,
			);
			drawFn(ctx, width, height);
		} catch (err) {
			return {
				success: false,
				error: `Canvas error: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	// Export to PNG
	const pngBuffer = canvas.toBuffer("image/png");
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, pngBuffer);

	const base64 = pngBuffer.toString("base64");

	return { success: true, pngPath: outputPath, base64 };
}
