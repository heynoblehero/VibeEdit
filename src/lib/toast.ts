"use client";

import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around sonner so feature code never imports it
 * directly. Centralizing here lets us swap libs later and gives us
 * one place to standardize variants / durations.
 *
 * Use these instead of inline red error boxes.
 *
 * Spam guard: identical (variant + message) calls within 800ms drop
 * the duplicate. Without this, a tight loop of "Saved" / "Added scene"
 * stacks 5 toasts on top of each other and obscures the editor.
 */
interface ToastOpts {
	description?: string;
	duration?: number;
}

const DEDUPE_WINDOW_MS = 800;
const recentKeys = new Map<string, number>();

function shouldDrop(variant: string, message: string): boolean {
	const key = `${variant}:${message}`;
	const now = Date.now();
	const last = recentKeys.get(key) ?? 0;
	if (now - last < DEDUPE_WINDOW_MS) return true;
	recentKeys.set(key, now);
	// Trim the map so it doesn't grow unboundedly. 50 keys is plenty
	// for any realistic concurrent set.
	if (recentKeys.size > 50) {
		const oldestKey = recentKeys.keys().next().value;
		if (oldestKey) recentKeys.delete(oldestKey);
	}
	return false;
}

export const toast = {
	success(message: string, opts?: ToastOpts) {
		if (shouldDrop("success", message)) return;
		return sonnerToast.success(message, opts);
	},
	error(message: string, opts?: ToastOpts) {
		if (shouldDrop("error", message)) return;
		return sonnerToast.error(message, opts);
	},
	info(message: string, opts?: ToastOpts) {
		if (shouldDrop("info", message)) return;
		return sonnerToast(message, opts);
	},
	loading(message: string) {
		return sonnerToast.loading(message);
	},
	/**
	 * Promise toast: shows loading, swaps to success/error when the
	 * promise settles. Returns the awaited value.
	 */
	async promise<T>(
		promise: Promise<T>,
		messages: { loading: string; success: string | ((value: T) => string); error: string | ((err: unknown) => string) },
	): Promise<T> {
		sonnerToast.promise(promise, messages);
		return promise;
	},
	dismiss(id?: string | number) {
		sonnerToast.dismiss(id);
	},
};
