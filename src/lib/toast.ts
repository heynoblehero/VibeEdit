"use client";

import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around sonner so feature code never imports it
 * directly. Centralizing here lets us swap libs later and gives us
 * one place to standardize variants / durations.
 *
 * Use these instead of inline red error boxes.
 */
interface ToastOpts {
	description?: string;
	duration?: number;
}

export const toast = {
	success(message: string, opts?: ToastOpts) {
		return sonnerToast.success(message, opts);
	},
	error(message: string, opts?: ToastOpts) {
		return sonnerToast.error(message, opts);
	},
	info(message: string, opts?: ToastOpts) {
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
