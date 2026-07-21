"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal wrapper: fades + slides its children in the first time they
 * scroll into view, giving the landing page a guided "journey" feel. Reveals
 * once, then stops observing. Honors prefers-reduced-motion by showing content
 * immediately with no transition (the CSS also hard-disables the transforms).
 *
 * Add `stagger` to cascade a container's direct children (e.g. a card grid) via
 * CSS nth-child delays — no per-child wrappers needed.
 */
export function Reveal({
  children,
  delay = 0,
  stagger = false,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  stagger?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = [
    stagger ? "reveal-stagger" : "reveal",
    visible ? "reveal-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
