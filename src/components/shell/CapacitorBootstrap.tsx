"use client";

import { useEffect } from "react";
import { runCapacitorBootstrap } from "@/lib/native/capacitor-bootstrap";

/**
 * Mounts the Capacitor wiring exactly once. Renders nothing — its only
 * job is to fire `runCapacitorBootstrap()` on first hydration. Keeping
 * this in its own component (rather than calling the bootstrap inline
 * from layout.tsx) means the Server Component layout file doesn't need
 * to be flipped to a client component.
 */
export function CapacitorBootstrap(): null {
	useEffect(() => {
		void runCapacitorBootstrap();
	}, []);
	return null;
}
