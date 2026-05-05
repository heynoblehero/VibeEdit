"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";

/**
 * Surfaces the "we just recovered from corrupted storage" toast set
 * by the project store's onRehydrateStorage hook. Reads + clears the
 * sessionStorage flag on mount so it fires exactly once per recovery.
 *
 * Mounted in the root layout so it runs on every entry point.
 */
export function RecoveryToast() {
	useEffect(() => {
		try {
			if (sessionStorage.getItem("vibeedit-recovery") === "1") {
				sessionStorage.removeItem("vibeedit-recovery");
				toast.info("Recovered from corrupted storage", {
					description:
						"We hit a parse error reading your saved projects and reset that key. Other state (assets, styles, render queue) is intact.",
				});
			}
		} catch {
			// best-effort
		}
	}, []);
	return null;
}
