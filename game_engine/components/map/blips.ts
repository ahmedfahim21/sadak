/**
 * Markers on the maps, drawn in screen space: errands, the barber, the
 * waypoint pin, monuments' entrances, and the route line to the waypoint.
 * A marker beyond the minimap's reach is pinned to its rim, with a pointer
 * showing which way it lies, so an errand is never simply off the map.
 */

import type { Pt } from "@/lib/game/world/mapData";

/**
 * Where a point `(ox, oy)` from the map's centre goes on a square map of
 * half-size `limit`: itself if inside, else on the rim along the same line.
 */
export function pinToEdge(ox: number, oy: number, limit: number): { x: number; y: number; pinned: boolean; angle: number } {
  const m = Math.max(Math.abs(ox), Math.abs(oy));
  const angle = Math.atan2(oy, ox);
  if (m <= limit) return { x: ox, y: oy, pinned: false, angle };
  const k = limit / m;
  return { x: ox * k, y: oy * k, pinned: true, angle };
}

/** An errand (or the barber): a coloured disc; on the rim, smaller, with a pointer out. */
export function drawBlip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  o: { ui: number; done?: boolean; pinned?: boolean; angle?: number; ring?: boolean }
) {
  const r = (o.pinned ? 3.6 : 4.5) * o.ui;
  ctx.save();
  ctx.globalAlpha = o.done ? 0.45 : 1;
  if (o.pinned && o.angle !== undefined) {
    // The pointer: a small wedge on the outside, toward the errand.
    ctx.translate(x, y);
    ctx.rotate(o.angle);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(r + 4.5 * o.ui, 0);
    ctx.lineTo(r - 0.5 * o.ui, -3 * o.ui);
    ctx.lineTo(r - 0.5 * o.ui, 3 * o.ui);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-o.angle);
    ctx.translate(-x, -y);
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(x + 1.2 * o.ui, y + 1.2 * o.ui, r + 1.5 * o.ui, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = o.ring ? "#ffffff" : "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(1, (o.ring ? 2.2 : 1.5) * o.ui);
  ctx.beginPath();
  ctx.arc(x, y, r + 0.5 * o.ui, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The waypoint: a white map pin, its point on the spot. */
export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, o: { ui: number; pinned?: boolean; angle?: number }) {
  if (o.pinned) return drawBlip(ctx, x, y, "#ffffff", { ui: o.ui, pinned: true, angle: o.angle });
  const r = 5 * o.ui;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(1.5 * o.ui, 0.5 * o.ui, r * 0.7, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-r * 0.4, -r * 1.2, -r, -r * 1.5, -r, -r * 2.2);
  ctx.arc(0, -r * 2.2, r, Math.PI, 0);
  ctx.bezierCurveTo(r, -r * 1.5, r * 0.4, -r * 1.2, 0, 0);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.4 * o.ui);
  ctx.strokeStyle = "#1d2229";
  ctx.stroke();
  ctx.fillStyle = "#1d2229";
  ctx.beginPath();
  ctx.arc(0, -r * 2.2, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A monument's entrance: a small gold arch, the way in. */
export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, ui: number) {
  const w = 3.4 * ui;
  const h = 5 * ui;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-w, h / 2);
  ctx.lineTo(-w, -h / 2 + w);
  ctx.arc(0, -h / 2 + w, w, Math.PI, 0);
  ctx.lineTo(w, h / 2);
  ctx.closePath();
  ctx.fillStyle = "#f5c518";
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.2 * ui);
  ctx.strokeStyle = "rgba(10,12,16,0.9)";
  ctx.stroke();
  ctx.fillStyle = "rgba(10,12,16,0.85)";
  ctx.fillRect(-w * 0.45, -h / 2 + w * 0.9, w * 0.9, h - w * 0.9);
  ctx.restore();
}

/** The route to the waypoint: a white line in a dark casing, like a satnav's. */
export function drawRoute(ctx: CanvasRenderingContext2D, pts: Pt[], toScreen: (p: Pt) => [number, number], ui: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = toScreen(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "rgba(10,12,16,0.75)";
  ctx.lineWidth = 5 * ui;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2.6 * ui;
  ctx.stroke();
  ctx.restore();
}
