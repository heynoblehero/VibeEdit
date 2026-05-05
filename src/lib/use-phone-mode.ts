"use client";

import { useEffect, useState } from "react";

/**
 * The single source of truth for "are we in phone shell mode?".
 *
 * 720px is the breakpoint we picked when we first added the Capacitor
 * APK — below that, the rails don't fit side-by-side, so the editor
 * swaps to a phone-first shell with a bottom tab bar. The dashboard
 * uses the same threshold to switch to full-bleed cards.
 *
 * SSR returns false on the first render so server output is the
 * desktop layout; the resize effect immediately corrects on mount.
 * That means a phone user might see a brief flash of desktop before
 * the swap — acceptable cost vs the alternative (mismatching SSR/CSR
 * trees and getting a hydration warning).
 */
export const PHONE_BREAKPOINT_PX = 720;

export function usePhoneMode(): boolean {
	const [isPhone, setIsPhone] = useState(false);
	useEffect(() => {
		const update = () => setIsPhone(window.innerWidth < PHONE_BREAKPOINT_PX);
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return isPhone;
}
