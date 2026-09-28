"use client";

/**
 * The waypoint's walk: a route along the streets from wherever the player
 * is, re-planned as they go (every half second, once they have moved a few
 * metres), and cleared when they get there.
 */

import { useEffect, useRef, useState } from "react";
import type { LiveState } from "@/lib/game/engine";
import type { MapData, Pt } from "@/lib/game/world/mapData";
import { planWalk } from "@/lib/game/world/route";
import type { Waypoint } from "./mapKit";

/** Close enough to count as arrived, metres. */
export const ARRIVE = 6;
const REPLAN_MOVE = 8;

export function useWaypointRoute(map: MapData | null, live: LiveState | null, waypoint: Waypoint | null, onArrive: () => void) {
  const [route, setRoute] = useState<Pt[] | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;

  useEffect(() => {
    if (!map || !waypoint) {
      setRoute(null);
      return;
    }
    let from: Pt | null = null;
    const tick = () => {
      const l = liveRef.current;
      if (!l) return;
      if (Math.hypot(l.x - waypoint.x, l.z - waypoint.z) < ARRIVE) {
        arriveRef.current();
        return;
      }
      if (from && Math.hypot(l.x - from[0], l.z - from[1]) < REPLAN_MOVE) return;
      from = [l.x, l.z];
      const walk = planWalk(map, l.x, l.z, waypoint.x, waypoint.z);
      // From the player, along the streets, to the pin itself.
      setRoute(walk ? [[l.x, l.z], ...walk, [waypoint.x, waypoint.z]] : [[l.x, l.z], [waypoint.x, waypoint.z]]);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [map, waypoint]);

  return route;
}
