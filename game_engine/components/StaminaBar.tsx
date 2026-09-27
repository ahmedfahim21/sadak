"use client";

/**
 * Sprint breath: a thin bar at the bottom of the screen that shows only
 * while it's short of full, amber when you've run yourself out. Reads the
 * engine's live state each frame and writes the width straight to the DOM,
 * so it never re-renders React.
 */

import { useEffect, useRef } from "react";
import type { LiveState } from "@/lib/game/engine";

export function StaminaBar({ live }: { live: LiveState | null }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const fill = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const l = liveRef.current;
      if (!l || !wrap.current || !fill.current) return;
      wrap.current.style.opacity = l.stamina < 0.99 ? "1" : "0";
      fill.current.style.width = `${(l.stamina * 100).toFixed(1)}%`;
      fill.current.style.background = l.winded ? "#f08a24" : "#f4f1ea";
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden
      className="pointer-events-none absolute bottom-3 left-1/2 z-20 h-1.5 w-40 -translate-x-1/2 overflow-hidden rounded-full bg-black/45 opacity-0 transition-opacity duration-500"
    >
      <div ref={fill} className="h-full rounded-full" />
    </div>
  );
}
