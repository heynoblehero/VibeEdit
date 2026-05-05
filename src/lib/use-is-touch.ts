"use client";

import { useEffect, useState } from "react";

/**
 * True when the primary input is coarse (finger). One source of truth
 * for "should we render the touch path?" — gates long-press menus,
 * always-visible overflow buttons, and ≥44px hit-target padding.
 *
 * SSR returns false; the real value resolves after mount via
 * matchMedia. A change listener catches Surface-style devices that
 * flip between mouse and touch mid-session.
 */
export function useIsTouch(): boolean {
	const [isTouch, setIsTouch] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(pointer: coarse)");
		const update = () => setIsTouch(mql.matches);
		update();
		mql.addEventListener("change", update);
		return () => mql.removeEventListener("change", update);
	}, []);
	return isTouch;
}
