"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MapData, Pt } from "@/lib/game/world/mapData";
import type { LiveState, TaskSnapshot, Telemetry } from "@/lib/game/engine";
import type { District } from "@/lib/game/districts";
import type { BaseLangCode } from "@/lib/i18n/base-lang";
import { gloss } from "@/lib/i18n/gloss";
import type { StreetTask, TaskKind } from "@/lib/game/tasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { css, entrances, kindColour, renderStreetMap, taskLook, type Waypoint } from "@/components/map/mapKit";
import { drawBlip, drawDoor, drawPin, drawRoute, pinToEdge } from "@/components/map/blips";
import { ErrandBadge } from "@/components/map/errandIcons";
import type { Landmark } from "@/lib/game/assets";
import { roadLabels, type RoadLabel } from "@/lib/game/world/mapLabels";
import { LocationCard } from "@/components/map/LocationCard";
import { StaminaBar } from "@/components/StaminaBar";
import { LocateFixed, PanelLeftClose, PanelLeftOpen, Volume2, VolumeX } from "lucide-react";

const MAP_PX = 168;
const MAP_PX_MOBILE = 80;
const MAP_RANGE = 90;

/** Duolingo-style circular lesson progress ring. */
function ProgressRing({
  done,
  total,
  size = 36,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  if (total <= 0) return null;
  const pct = Math.min(done / total, 1);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#58cc02"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground font-heading text-[0.55rem]"
      >
        {done}/{total}
      </text>
    </svg>
  );
}

/**
 * Draws from the engine's LiveState on its own rAF rather than from React
 * state, so the map stays smooth at 60fps while the HUD around it only
 * re-renders when something actually changes.
 *
 * Previously this ran a useEffect keyed on `tel`, which arrived every frame,
 * and reassigned canvas.width/height on each pass — reallocating the backing
 * store 60 times a second inside the game's own rAF callback. That was the
 * single largest source of frame-time jitter in the whole app.
 */
function Minimap({
  live,
  tasks,
  barber,
  waypoint,
  route,
  size,
  map,
  onOpen,
}: {
  live: LiveState | null;
  tasks: TaskSnapshot[];
  barber?: { x: number; z: number };
  waypoint: Waypoint | null;
  /** The walk to the waypoint, along the streets. */
  route: Pt[] | null;
  size: number;
  map: MapData;
  /** Open the full map. */
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const streets = useRef<{ map: MapData; canvas: HTMLCanvasElement; labels: RoadLabel[] } | null>(null);
  if (typeof document !== "undefined" && streets.current?.map !== map) {
    streets.current = { map, canvas: renderStreetMap(map), labels: roadLabels(map) };
  }
  // Read through a ref so the draw loop never needs to be torn down and
  // rebuilt when the (throttled) task list changes.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const barberRef = useRef(barber);
  barberRef.current = barber;
  const waypointRef = useRef(waypoint);
  waypointRef.current = waypoint;
  const routeRef = useRef(route);
  routeRef.current = route;
  const doorsRef = useRef<Pt[]>([]);
  doorsRef.current = useMemo(() => entrances(map), [map]);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(devicePixelRatio, 2);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const l = liveRef.current;
      if (!l) return;

      // Only touch width/height when they actually change; assigning them is
      // what reallocates (and clears) the backing store.
      const w = Math.round(size * dpr);
      if (canvas.width !== w || canvas.height !== w) {
        canvas.width = w;
        canvas.height = w;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const R = size / 2;
      const scale = R / MAP_RANGE;
      const ui = size / MAP_PX;

      // A rounded square, filling its card (GTA's minimap, not a disc in a box).
      const corner = 4 * ui;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(1, 1, size - 2, size - 2, corner);
      ctx.clip();

      ctx.fillStyle = "#1d2229";
      ctx.fillRect(0, 0, size, size);

      ctx.translate(R, R);
      ctx.rotate(l.heading + Math.PI);
      ctx.translate(-l.x * scale, -l.z * scale);

      const sm = streets.current;
      if (sm) {
        const h = sm.map.half;
        ctx.drawImage(sm.canvas, -h * scale, -h * scale, h * 2 * scale, h * 2 * scale);
      }

      // The route to the waypoint, under everything else.
      const route = routeRef.current;
      if (route) drawRoute(ctx, route, (p) => [p[0] * scale, p[1] * scale], ui);

      ctx.restore();

      // Street names nearby, upright over the turning map, biggest roads
      // first and never on top of each other.
      if (sm && size >= 120) {
        const th = l.heading + Math.PI;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        ctx.font = `${(9 * ui).toFixed(1)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        const used: [number, number, number][] = [];
        for (const lb of sm.labels) {
          const dx = (lb.x - l.x) * scale;
          const dz = (lb.z - l.z) * scale;
          const sx = R + dx * cs - dz * sn;
          const sy = R + dx * sn + dz * cs;
          if (Math.max(Math.abs(sx - R), Math.abs(sy - R)) > R * 0.78) continue;
          const w = ctx.measureText(lb.name).width;
          if (w > size * 0.85) continue;
          if (used.some(([ux, uy, uw]) => Math.abs(ux - sx) < (uw + w) / 2 + 4 && Math.abs(uy - sy) < 12 * ui)) continue;
          ctx.lineWidth = 3 * ui;
          ctx.strokeStyle = "rgba(10,12,16,0.85)";
          ctx.strokeText(lb.name, sx, sy);
          ctx.fillStyle = "#e8edf2";
          ctx.fillText(lb.name, sx, sy);
          used.push([sx, sy, w]);
          if (used.length >= 4) break;
        }
      }

      // Markers in screen space: entrances where they are (in range only),
      // errands, the barber and the waypoint pinned to the rim when beyond it.
      const th = l.heading + Math.PI;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const rel = (x: number, z: number): [number, number] => {
        const dx = (x - l.x) * scale;
        const dz = (z - l.z) * scale;
        return [dx * cs - dz * sn, dx * sn + dz * cs];
      };
      // In from the edge by a pointer's length, so the pointer shows.
      const rim = R - 11 * ui;
      for (const [x, z] of doorsRef.current) {
        const [ox, oy] = rel(x, z);
        if (Math.max(Math.abs(ox), Math.abs(oy)) < rim) drawDoor(ctx, R + ox, R + oy, ui);
      }
      const b = barberRef.current;
      if (b) {
        const p = pinToEdge(...rel(b.x, b.z), rim);
        drawBlip(ctx, R + p.x, R + p.y, kindColour("barber", false), { ui, pinned: p.pinned, angle: p.angle });
      }
      // Done errands first, so the ones still to do sit on top.
      for (const t of [...tasksRef.current].sort((a, c) => Number(c.done) - Number(a.done))) {
        const p = pinToEdge(...rel(t.x, t.z), rim);
        drawBlip(ctx, R + p.x, R + p.y, t.colour, { ui, done: t.done, pinned: p.pinned, angle: p.angle });
      }
      const wp = waypointRef.current;
      if (wp) {
        const p = pinToEdge(...rel(wp.x, wp.z), rim);
        drawPin(ctx, R + p.x, R + p.y, { ui, pinned: p.pinned, angle: p.angle });
      }

      ctx.fillStyle = "#5ab0ff";
      ctx.beginPath();
      ctx.moveTo(R, R - 7 * ui);
      ctx.lineTo(R - 5 * ui, R + 5 * ui);
      ctx.lineTo(R + 5 * ui, R + 5 * ui);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(1, 1.5 * ui);
      ctx.beginPath();
      ctx.roundRect(1, 1, size - 2, size - 2, corner);
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className="cursor-pointer"
      onClick={onOpen}
      role="button"
      aria-label="Open the map (M)"
    />
  );
}

export function MinimapPanel({
  live,
  tasks,
  barber,
  waypoint,
  route,
  size,
  map,
  onRecenter,
  onOpenMap,
  showKey = false,
}: {
  live: LiveState | null;
  tasks: TaskSnapshot[];
  barber?: { x: number; z: number };
  waypoint: Waypoint | null;
  route: Pt[] | null;
  size: number;
  map: MapData;
  onRecenter: () => void;
  onOpenMap: () => void;
  /** Say under it that M opens the map (keyboard play); on it, it hid the streets. */
  showKey?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
    <div className="relative block overflow-hidden rounded-base">
      <Minimap live={live} tasks={tasks} barber={barber} waypoint={waypoint} route={route} size={size} map={map} onOpen={onOpenMap} />
      <Button
        variant="neutral"
        size="icon"
        className="absolute right-0.5 bottom-0.5 size-7 min-w-0"
        sound="tap"
        onClick={onRecenter}
        aria-label="Recentre"
      >
        <LocateFixed className="size-3.5" aria-hidden />
      </Button>
    </div>
      {showKey && <span className="text-[10px] leading-none text-foreground/60">M for the full map</span>}
    </div>
  );
}

function HudCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("pointer-events-auto gap-2 py-3 shadow-shadow", className)}>
      {children}
    </Card>
  );
}

/**
 * The errands, in one list: each with its marker (its colour and icon, as on
 * the maps) and how far away it is, the nearest picked out; a finished one
 * turns to a tick and says what came of it. Progress sits in its header.
 */
function Errands({
  tasks,
  completed,
  city,
  tel,
  compact,
}: {
  tasks: StreetTask[];
  completed: Set<string>;
  city: Landmark;
  tel: Telemetry | null;
  compact?: boolean;
}) {
  const done = tasks.filter((t) => completed.has(t.id)).length;
  const away = (id: string) => {
    const at = tel?.tasks.find((s) => s.id === id);
    return at && tel ? Math.hypot(at.x - tel.playerX, at.z - tel.playerZ) : null;
  };
  const open = tasks.filter((t) => !completed.has(t.id));
  const nearest = open.reduce<{ id: string; d: number } | null>((best, t) => {
    const d = away(t.id);
    return d !== null && (!best || d < best.d) ? { id: t.id, d } : best;
  }, null);
  return (
    <>
      <CardHeader className={cn("gap-1.5 pb-0", compact ? "px-3" : "px-4")}>
        <CardTitle className={cn("flex items-baseline justify-between uppercase tracking-widest text-foreground/60", compact ? "text-[0.65rem]" : "text-xs")}>
          Errands
          <span className="normal-case tracking-normal text-foreground/70">
            {done === tasks.length && tasks.length > 0 ? "All done" : `${done} of ${tasks.length}`}
          </span>
        </CardTitle>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <div className="h-full rounded-full bg-main transition-[width] duration-700" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
        </div>
      </CardHeader>
      <CardContent className={cn("pt-1", compact ? "px-2" : "px-3")}>
        {/* minmax(0, 1fr): without it the column grows to its longest line and nothing truncates. */}
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
          {tasks.map((t) => {
            const finished = completed.has(t.id);
            const d = finished ? null : away(t.id);
            const next = nearest?.id === t.id;
            const look = taskLook(t, city);
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-2 rounded-base px-1.5 py-1 transition-colors",
                  next && "bg-main/15",
                  finished && "opacity-60"
                )}
              >
                <ErrandBadge id={finished ? "done" : look.icon} colour={css(t.colour)} className={compact ? "size-4" : undefined} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", compact ? "text-xs" : "text-sm")}>{t.title}</span>
                  <span className={cn("block truncate text-foreground/65", compact ? "text-[0.65rem]" : "text-xs")}>
                    {finished ? t.completionNote : `${look.label} · ${t.name}`}
                  </span>
                </span>
                {d !== null && (
                  <span className={cn("shrink-0 tabular-nums text-foreground/65", compact ? "text-[0.65rem]" : "text-xs", next && "text-foreground")}>
                    {d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </>
  );
}

export default function Hud({
  district,
  baseLang,
  tasks,
  tel,
  cash,
  xp,
  live,
  completed,
  errandProgress,
  onOpen,
  barberNearby = false,
  barberLabel = "Enter barber shop",
  onEnterBarber,
  phrasesOpen,
  onTogglePhrases,
  onMenu,
  onRecenter,
  mobilePlay,
  panelsOpen,
  onTogglePanels,
  audioOn,
  onToggleAudio,
  map,
  onSkipRide,
  onOpenMap,
  onPlace,
  waypoint,
  route,
}: {
  map: MapData;
  /** Open the full map (also on M). */
  onOpenMap: () => void;
  /** Where the player marked on the full map, and the walk there. */
  waypoint: Waypoint | null;
  route: Pt[] | null;
  /** A place walked into: its find tally the first time, else null. */
  onPlace: (name: string) => { found: number; total: number } | null;
  /** Jump to the end of an auto or bus ride. */
  onSkipRide: () => void;
  district: District;
  baseLang: BaseLangCode;
  tasks: StreetTask[];
  tel: Telemetry | null;
  /** Engine-owned, mutated per frame. Only the minimap reads it. */
  live: LiveState | null;
  cash: number;
  xp: number;
  completed: Set<string>;
  errandProgress: { done: number; total: number };
  onOpen: () => void;
  barberNearby?: boolean;
  barberLabel?: string;
  onEnterBarber?: () => void;
  phrasesOpen: boolean;
  onTogglePhrases: () => void;
  onMenu: () => void;
  onRecenter: () => void;
  mobilePlay: boolean;
  panelsOpen: boolean;
  onTogglePanels: () => void;
  audioOn: boolean;
  onToggleAudio: () => void;
}) {
  const nearbyTask = tel?.nearby ? tasks.find((t) => t.id === tel.nearby) : null;
  const mapSize = mobilePlay ? MAP_PX_MOBILE : MAP_PX;

  const statsRow = (
    <>
      <Badge className={cn("font-heading", mobilePlay ? "text-sm" : "text-base")}>
        ₹{cash.toLocaleString("en-IN")}
      </Badge>
      <Badge variant="neutral" className={mobilePlay ? "text-xs" : undefined}>
        {xp} XP
      </Badge>
      {/* On a wide screen the errands card carries the progress. */}
      {errandProgress.total > 0 && (
        <div className={cn("flex items-center gap-2", !mobilePlay && "min-[621px]:hidden")}>
          <ProgressRing done={errandProgress.done} total={errandProgress.total} />
          <span className="text-xs text-foreground/70">
            {errandProgress.done === errandProgress.total
              ? "District complete!"
              : `${errandProgress.total - errandProgress.done} left`}
          </span>
        </div>
      )}
    </>
  );


  return (
    <>
      <LocationCard map={map} live={live} district={district} compact={mobilePlay} onPlace={onPlace} />
      <StaminaBar live={live} />
      {mobilePlay ? (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
              {statsRow}
              <Button
                variant="neutral"
                size="icon"
                className="size-8 shrink-0"
                sound="tap"
                onClick={onTogglePanels}
                aria-expanded={panelsOpen}
                aria-label={panelsOpen ? "Hide game panels" : "Show game panels"}
              >
                {panelsOpen ? (
                  <PanelLeftClose className="size-4" aria-hidden />
                ) : (
                  <PanelLeftOpen className="size-4" aria-hidden />
                )}
              </Button>
              <Button
                variant="neutral"
                size="icon"
                className="size-8 shrink-0"
                sound={audioOn ? "toggleOff" : "toggleOn"}
                onClick={onToggleAudio}
                aria-label={audioOn ? "Mute sound" : "Unmute sound"}
              >
                {audioOn ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
              </Button>
            </div>
            {tel && (
              <HudCard className="pointer-events-auto p-1">
                <CardContent className="px-0 py-0">
                  <MinimapPanel
                    map={map}
                    live={live}
                    tasks={tel.tasks}
                    barber={tel.barber}
                    waypoint={waypoint}
                    route={route}
                    size={mapSize}
                    onRecenter={onRecenter}
                    onOpenMap={onOpenMap}
                  />
                </CardContent>
              </HudCard>
            )}
          </div>

          {panelsOpen && (
            <div className="pointer-events-auto absolute top-[7.5rem] left-3 z-20 flex max-h-[min(52vh,22rem)] w-[min(18rem,calc(100vw-5.5rem))] flex-col gap-2 overflow-y-auto">
              <HudCard className="py-2">
                <CardHeader className="px-3 pb-0">
                  <CardTitle className="text-[0.65rem] uppercase tracking-widest text-foreground/60">
                    {district.name} · {district.native}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 px-3 pt-2">
                  <Button variant="neutral" size="sm" className="h-8 text-xs" onClick={onTogglePhrases}>
                    Phrasebook
                  </Button>
                  <Button variant="neutral" size="sm" className="h-8 text-xs" onClick={onMenu}>
                    Menu
                  </Button>
                </CardContent>
              </HudCard>
              <HudCard className="py-2">
                <Errands tasks={tasks} completed={completed} city={district.theme.landmark} tel={tel} compact />
              </HudCard>
            </div>
          )}

          {phrasesOpen && (
            <HudCard className="pointer-events-auto absolute top-20 right-3 z-30 w-72 max-w-[calc(100vw-1.5rem)] py-2">
              <CardHeader className="px-3 pb-0">
                <CardTitle className="text-xs uppercase tracking-widest">
                  Say it in {district.native}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[40vh] overflow-y-auto px-3 pt-2">
                <Accordion type="single" collapsible className="w-full">
                  {district.phrases.map((p) => (
                    <AccordionItem key={p.native} value={p.native}>
                      <AccordionTrigger className="py-2 text-sm">{p.native}</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-main">{p.roman}</p>
                        <p className="text-foreground/70">{gloss(p.en, baseLang)}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </HudCard>
          )}
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-6 top-4 flex items-start justify-between gap-4">
            <div className="flex flex-col items-start gap-2">
              {statsRow}
            </div>
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
              <Badge variant="neutral" className="uppercase tracking-widest">
                {district.name} · <strong className="font-indic normal-case">{district.native}</strong>
              </Badge>
              <Button variant="neutral" size="sm" onClick={onOpenMap}>
                <kbd>M</kbd> Map
              </Button>
              <Button variant="neutral" size="sm" onClick={onTogglePhrases}>
                <kbd>P</kbd> Phrasebook
              </Button>
              <Button variant="neutral" size="sm" onClick={onMenu}>
                <kbd>Esc</kbd> Menu
              </Button>
              <Button
                variant="neutral"
                size="icon"
                sound={audioOn ? "toggleOff" : "toggleOn"}
                onClick={onToggleAudio}
                aria-label={audioOn ? "Mute sound" : "Unmute sound"}
              >
                {audioOn ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>

          {phrasesOpen && (
            <HudCard className="absolute top-20 right-6 z-10 w-80 max-w-[calc(100vw-3rem)]">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm uppercase tracking-widest">
                  Say it in {district.native}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-2">
                <Accordion type="single" collapsible className="w-full">
                  {district.phrases.map((p) => (
                    <AccordionItem key={p.native} value={p.native}>
                      <AccordionTrigger className="text-sm">{p.native}</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-main">{p.roman}</p>
                        <p className="text-foreground/70">{gloss(p.en, baseLang)}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <p className="mt-3 text-xs text-foreground/70">
                  Type or speak these. They work on anyone in this district.
                </p>
              </CardContent>
            </HudCard>
          )}

          <HudCard className="absolute top-32 left-6 w-72 max-w-[calc(100vw-3rem)] max-[620px]:hidden max-lg:top-20 max-lg:w-60">
            <Errands tasks={tasks} completed={completed} city={district.theme.landmark} tel={tel} compact={false} />
          </HudCard>

          <div className="absolute right-6 bottom-6 max-lg:origin-bottom-right max-lg:scale-90">
            {tel && (
              <HudCard className="p-1">
                <CardContent className="p-0">
                  <MinimapPanel
                    map={map}
                    live={live}
                    tasks={tel.tasks}
                    barber={tel.barber}
                    waypoint={waypoint}
                    route={route}
                    size={mapSize}
                    onRecenter={onRecenter}
                    onOpenMap={onOpenMap}
                    showKey
                  />
                </CardContent>
              </HudCard>
            )}
          </div>
        </>
      )}

      {tel?.ride && (
        <Button
          variant="neutral"
          className={cn(
            "pointer-events-auto absolute left-1/2 -translate-x-1/2",
            mobilePlay ? "top-3 text-sm" : "top-6"
          )}
          size={mobilePlay ? "default" : "lg"}
          onClick={onSkipRide}
        >
          Riding to {tel.ride}
          {!mobilePlay && <kbd>E</kbd>}
          Skip
        </Button>
      )}

      {nearbyTask ? (
        <Button
          className={cn(
            mobilePlay
              ? "pointer-events-auto absolute bottom-6 left-4 z-30 max-w-[min(14rem,calc(100vw-8rem))] text-sm"
              : "absolute bottom-20 left-1/2 -translate-x-1/2"
          )}
          size={mobilePlay ? "default" : "lg"}
          onClick={onOpen}
        >
          {!mobilePlay && <kbd>E</kbd>}
          {nearbyTask.interactLabel}
        </Button>
      ) : barberNearby && onEnterBarber ? (
        <Button
          className={cn(
            mobilePlay
              ? "pointer-events-auto absolute bottom-6 left-4 z-30 max-w-[min(14rem,calc(100vw-8rem))] text-sm"
              : "absolute bottom-20 left-1/2 -translate-x-1/2"
          )}
          size={mobilePlay ? "default" : "lg"}
          variant="neutral"
          onClick={onEnterBarber}
        >
          {!mobilePlay && <kbd>E</kbd>}
          {barberLabel}
        </Button>
      ) : null}
    </>
  );
}
