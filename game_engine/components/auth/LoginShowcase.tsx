"use client";

import { useEffect, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { SEED_DISTRICTS } from "@/lib/game/districts";
import { DISTRICT_COVER_IMAGES, DISTRICT_GALLERY } from "@/lib/game/district-covers";
import { cn } from "@/lib/utils";

/** Every still from the game, cities interleaved so neighbours differ. */
const POOL: StaticImageData[] = (() => {
  const byCity = SEED_DISTRICTS.map((d) => [DISTRICT_COVER_IMAGES[d.id], ...(DISTRICT_GALLERY[d.id]?.views.map((v) => v.image) ?? [])]);
  const out: StaticImageData[] = [];
  for (let i = 0; i < Math.max(...byCity.map((c) => c.length)); i++) for (const c of byCity) if (c[i]) out.push(c[i]);
  return out;
})();

const COLUMNS = 3;
/** Enough to run past the bottom on a tall screen (the columns are staggered). */
const PER_COLUMN = 8;
const TILES = COLUMNS * PER_COLUMN;
/** One tile changes this often, so something is always moving but nothing takes over. */
const SWAP_MS = 1600;

/**
 * A wall of stills from the game: three staggered columns of small views of
 * every city, one tile at a time crossfading to another, no one picture
 * large enough to dominate the sign-in. Still for reduced motion.
 */
export function LoginShowcase({ className }: { className?: string }) {
  // Each tile's current picture, and the one it's fading from.
  const [tiles, setTiles] = useState(() => Array.from({ length: TILES }, (_, i) => ({ now: i % POOL.length, was: -1 })));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let next = TILES;
    let step = 0;
    // A fixed scramble of the tiles, so the changes wander over the wall.
    const order = Array.from({ length: TILES }, (_, i) => (i * 7) % TILES);
    const id = window.setInterval(() => {
      const k = order[step++ % TILES];
      const pick = next++ % POOL.length;
      setTiles((ts) => ts.map((t, i) => (i === k ? { now: pick, was: t.now } : t)));
    }, SWAP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={cn("relative overflow-hidden bg-background", className)} aria-hidden>
      <div className="absolute -inset-y-[12%] inset-x-3 grid grid-cols-3 gap-3 lg:inset-x-5 lg:gap-4">
        {Array.from({ length: COLUMNS }, (_, c) => (
          <div
            key={c}
            className="flex flex-col gap-3 lg:gap-4"
            // Staggered, so the wall doesn't read as a grid.
            style={{ transform: `translateY(${[-6, 4, -14][c]}%)` }}
          >
            {tiles.slice(c * PER_COLUMN, (c + 1) * PER_COLUMN).map((t, r) => (
              <div
                key={r}
                className="relative aspect-[8/5] shrink-0 overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-shadow"
              >
                {t.was >= 0 && (
                  <Image src={POOL[t.was]} alt="" fill sizes="(max-width: 1024px) 33vw, 18vw" className="object-cover" />
                )}
                <Image
                  key={t.now}
                  src={POOL[t.now]}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 33vw, 18vw"
                  className={cn("object-cover", t.was >= 0 && "animate-[tile-in_1.2s_ease-out_both]")}
                  priority={c * PER_COLUMN + r < 6}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
