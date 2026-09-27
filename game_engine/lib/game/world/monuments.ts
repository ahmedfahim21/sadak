/**
 * Walkable monuments, built to fit their real footprints.
 *
 * Each builder works in its own frame: footprint centred on the origin, `w`
 * across (x) and `d` deep (z), with the entrance on the +z side, which the
 * map compiler turns toward the street. A builder returns its geometry plus
 * the walls that block (colliders) and the surfaces that can be climbed
 * (heights), so a mosque's grand stair actually carries the player up onto
 * the plinth and into the courtyard, and a temple's steps lead up into the
 * mandapa.
 */

import * as THREE from "three";
import { Parts, archedSlab, onion, stripedShaft } from "./vc";
import { mulberry32 } from "../props";

export type LocalBox = { x: number; z: number; hw: number; hd: number; rot?: number };
/** Height from y0 at the local -z edge to y1 at +z (flat when equal). */
/** Height from y0 at the local -z edge to y1 at +z (flat when equal), turned
 *  by `rot` within the monument's frame. */
export type LocalRect = { x: number; z: number; hw: number; hd: number; y0: number; y1: number; rot?: number };

export type Monument = {
  group: THREE.Group;
  colliders: LocalBox[];
  heights: LocalRect[];
  /** Where a priest, a flower seller or a sevadar stands inside: in the
   *  mandapa, the mosque courtyard, on the gurdwara's platform. Local frame;
   *  they face +z, toward whoever comes up the steps. */
  inner?: { x: number; z: number };
};

const MARBLE = 0xf1ece2;
const DARK = 0x2f2722;
const WATER = 0x3f7fc0;
const GOLD = 0xe0b23a;
const SAFFRON = 0xf08a24;

function material() {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

export function finish(
  parts: Parts,
  colliders: LocalBox[],
  heights: LocalRect[],
  inner?: { x: number; z: number }
): Monument {
  const group = new THREE.Group();
  const m = parts.mesh(material());
  if (m) group.add(m);
  return { group, colliders, heights, inner };
}

/**
 * A raised platform with a flight of steps at the front, inside the
 * footprint. Returns the platform's depth span so builders can lay things
 * out on top. Edge walls stop the player walking off (or up) the sides.
 */
/** The highest plinth a person steps up onto anywhere along its edge, metres. */
const STEPPABLE = 0.7;

function platform(
  P: Parts,
  C: LocalBox[],
  Hs: LocalRect[],
  w: number,
  d: number,
  rise: number,
  stone: number,
  stairFrac = 0.35,
  edgeWalls = true
) {
  const stairW = Math.max(3, Math.min(w * stairFrac, 20));
  const n = Math.max(2, Math.round(rise / 0.17));
  const run = n * 0.32;
  const top = -d / 2;
  const front = d / 2 - run;
  const depth = front - top;
  const zc = (top + front) / 2;
  P.box(w, rise, depth, 0, rise / 2, zc, stone);
  P.steps(stairW, rise, 0, d / 2, stone);
  // Stair cheek walls.
  for (const s of [-1, 1]) P.box(0.6, rise + 0.3, run, s * (stairW / 2 + 0.3), (rise + 0.3) / 2, d / 2 - run / 2, stone);
  Hs.push({ x: 0, z: zc, hw: w / 2, hd: depth / 2, y0: rise, y1: rise });
  Hs.push({ x: 0, z: d / 2 - run / 2, hw: stairW / 2, hd: run / 2, y0: rise, y1: 0 });
  // Walls round the edge keep the player off a plinth except by its stair;
  // one low enough to step onto (and off) is just a step, and a wall along
  // it was an invisible fence when standing on top.
  if (edgeWalls && rise > STEPPABLE) {
    const t = 0.5;
    C.push({ x: 0, z: top + t / 2, hw: w / 2, hd: t / 2 });
    for (const s of [-1, 1]) C.push({ x: (s * (w - t)) / 2, z: zc, hw: t / 2, hd: depth / 2 });
    // Front edge either side of the stair.
    const side = (w - stairW) / 2 - 0.6;
    if (side > 0.2) for (const s of [-1, 1]) C.push({ x: s * (stairW / 2 + 0.6 + side / 2), z: front - t / 2, hw: side / 2, hd: t / 2 });
    for (const s of [-1, 1]) C.push({ x: s * (stairW / 2 + 0.3), z: d / 2 - run / 2, hw: 0.3, hd: run / 2 });
  }
  return { top, front, depth, zc, run, stairW };
}

/** Small open pavilion: four pillars and a dome. */
export function chhatri(P: Parts, x: number, y: number, z: number, s: number, stone: number, domeCol: number) {
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(0.25 * s, 1.6 * s, 0.25 * s, x + a * 0.7 * s, y + 0.8 * s, z + b * 0.7 * s, stone);
  P.box(2 * s, 0.2 * s, 2 * s, x, y + 1.7 * s, z, stone);
  P.dome(0.9 * s, x, y + 1.8 * s, z, domeCol);
}

/* ------------------------------------------------------------------ *
 * Mosque family
 * ------------------------------------------------------------------ */

export type MosqueStyle = {
  stone: number;
  /** Bands, arch frames and minaret stripes. */
  accent: number;
  dome: number;
  plinth: number;
  /** Over the prayer hall: Delhi's three onions, Ahmedabad's field of small
   *  domes, or none (the Mecca Masjid's flat roof between its minarets). */
  domes?: "three" | "many" | "none";
  /** Black inlay striping the domes and the minarets' marble. */
  stripe?: number;
  /** Stairs and gates on the two sides as well as the front. */
  sideGates?: boolean;
};

/** Neighbourhood masjid or dargah: low plinth, hall, one dome, two minarets. */
export function smallMosque(w: number, d: number, st: MosqueStyle): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const pf = platform(P, C, Hs, w, d, Math.min(st.plinth, 0.9), st.stone, 0.4);
  const y = Math.min(st.plinth, 0.9);
  const hallW = w * 0.78;
  const hallD = pf.depth * 0.62;
  const hz = pf.top + hallD / 2 + 0.6;
  const hf = hz + hallD / 2;
  const hallH = Math.min(7, 3 + w * 0.25);
  P.box(hallW, hallH, hallD, 0, y + hallH / 2, hz, st.stone);
  P.box(hallW + 0.3, 0.35, hallD + 0.3, 0, y + hallH - 0.15, hz, st.accent);
  // Three arched bays in framed recesses, the middle one taller.
  for (let k = -1; k <= 1; k++) {
    const x = (k * hallW) / 3;
    const bw = (hallW / 3) * (k === 0 ? 0.62 : 0.52);
    const bh = hallH * (k === 0 ? 0.8 : 0.66);
    P.box(bw + 0.5, bh + 0.5, 0.06, x, y + (bh + 0.5) / 2, hf + 0.03, st.accent);
    archWindow(P, x, y, hf + 0.07, bw, bh, DARK);
  }
  for (const k of [-0.5, 0.5]) P.box(0.3, hallH, 0.14, (k * hallW) / 1.5, y + hallH / 2, hf + 0.07, st.accent);
  // Crenellations along the front.
  const n = Math.max(4, Math.floor(hallW / 1.1));
  for (let k = 0; k < n; k++) P.box(0.55, 0.5, 0.22, -hallW / 2 + (k + 0.5) * (hallW / n), y + hallH + 0.25, hf - 0.1, st.stone);
  C.push({ x: 0, z: hz, hw: hallW / 2, hd: hallD / 2 });
  // Domes: a large one over the middle bay, two smaller either side.
  const r = Math.min(hallW * 0.18, hallD * 0.34);
  for (const [x, k] of [[0, 1], [-hallW / 3, 0.66], [hallW / 3, 0.66]] as const) {
    const rr = r * k;
    P.cyl(rr * 0.92, rr * 0.95, rr * 0.5, x, y + hallH + rr * 0.25, hz, st.stone, 12);
    onion(P, rr, x, y + hallH + rr * 0.5, hz, [st.dome]);
    P.cyl(0.05, 0.05, rr * 0.5, x, y + hallH + rr * 0.5 + rr * 1.55 + rr * 0.25, hz, GOLD, 5);
  }
  // Slender minarets at the front corners, banded, with a kiosk on top.
  const mh = hallH * 2.1;
  for (const sx of [-1, 1]) {
    const x = sx * (hallW / 2 + 0.4);
    stripedShaft(P, 0.42, 0.52, mh, x, y, hf, st.stone, st.accent, 12);
    for (const f of [0.45, 0.8]) P.cyl(0.8, 0.6, 0.3, x, y + mh * f, hf, st.accent, 12);
    chhatri(P, x, y + mh, hf, 0.45, st.stone, st.dome);
    C.push({ x, z: hf, hw: 0.55, hd: 0.55 });
  }
  return finish(P, C, Hs, { x: 0, z: Math.min(pf.front - 1, hf + 2) });
}

/** Tomb: a domed chamber with corner chhatris on a stepped plinth. */
export function tomb(w: number, d: number, st: MosqueStyle): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const pf = platform(P, C, Hs, w, d, Math.max(1, st.plinth * 0.6), st.stone, 0.3);
  const y = Math.max(1, st.plinth * 0.6);
  const s = Math.min(w, pf.depth) * 0.62;
  const h = s * 0.7;
  const cz = pf.zc;
  P.box(s, h, s, 0, y + h / 2, cz, st.stone);
  // Each face: a tall arch in a raised frame with a stone lattice (jaali)
  // over it, and a smaller latticed arch either side.
  for (let k = 0; k < 4; k++) {
    const rot = (k * Math.PI) / 2;
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const at = (u: number, o: number): [number, number] => [u * c + (s / 2 + o) * sn, cz - u * sn + (s / 2 + o) * c];
    const [fx, fz] = at(0, 0.04);
    P.box(s * 0.46, h * 0.86, 0.1, fx, y + h * 0.43, fz, st.accent, rot);
    for (const [u, aw, ah] of [[0, s * 0.3, h * 0.72], [-s * 0.34, s * 0.14, h * 0.45], [s * 0.34, s * 0.14, h * 0.45]] as const) {
      const [x, z] = at(u, 0.1);
      archWindow(P, x, y + 0.3, z, aw, ah, DARK, rot);
      // The lattice: bars across the opening.
      for (let r = 1; r < 5; r++) {
        const [bx, bz] = at(u, 0.14);
        P.box(aw * 0.9, 0.08, 0.06, bx, y + 0.3 + (r * (ah - aw / 2)) / 5, bz, st.stone, rot);
      }
      for (const v of [-0.25, 0.25]) {
        const [bx, bz] = at(u + v * aw, 0.14);
        P.box(0.08, ah - aw / 2, 0.06, bx, y + 0.3 + (ah - aw / 2) / 2, bz, st.stone, rot);
      }
    }
  }
  P.box(s + 0.4, 0.45, s + 0.4, 0, y + h + 0.22, cz, st.accent);
  const n = Math.max(6, Math.floor(s / 1.1));
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    for (let k = 0; k < n; k++) {
      const u = -s / 2 + (k + 0.5) * (s / n);
      P.box(dz ? 0.55 : 0.22, 0.5, dz ? 0.22 : 0.55, dx ? (dx * s) / 2 : u, y + h + 0.7, dz ? cz + (dz * s) / 2 : cz + u, st.stone);
    }
  }
  // Turrets at the corners, the drum and the dome.
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = (a * s) / 2;
    const z = cz + (b * s) / 2;
    stripedShaft(P, 0.45, 0.55, h + 2.2, x, y, z, st.stone, st.accent, 8);
    chhatri(P, x, y + h + 2.2, z, 0.5, st.stone, st.dome);
    chhatri(P, a * s * 0.3, y + h + 0.45, cz + b * s * 0.3, s * 0.06, st.stone, st.dome);
  }
  const r = s * 0.32;
  P.cyl(r * 0.95, r, r * 0.6, 0, y + h + 0.45 + r * 0.3, cz, st.accent, 16);
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2;
    archWindow(P, Math.sin(t) * r, y + h + 0.55, cz + Math.cos(t) * r, r * 0.22, r * 0.45, DARK, t);
  }
  onion(P, r, 0, y + h + 0.45 + r * 0.6, cz, [st.dome]);
  P.cyl(0.08, 0.08, r * 0.6, 0, y + h + 0.45 + r * 0.6 + r * 1.55 + r * 0.3, cz, GOLD, 6);
  C.push({ x: 0, z: cz, hw: s / 2 + 0.3, hd: s / 2 + 0.3 });
  return finish(P, C, Hs, { x: 0, z: Math.min(pf.front - 1, cz + s / 2 + 1.5) });
}

/* ------------------------------------------------------------------ *
 * Temples
 * ------------------------------------------------------------------ */

export type TempleStyle = {
  stone: number;
  accent: number;
  plinth: number;
  /** "nagara": North Indian curvilinear shikhara. "kalinga": Odisha rekha
   *  deul with a stepped jagamohana. */
  kind: "nagara" | "kalinga";
  /** Tower height relative to the footprint. */
  tower: number;
  /** Walled compound with a gateway (Lingaraj). */
  compound?: boolean;
};

/** Curvilinear tower: banded courses that swell and draw in to an amalaka. */
function shikhara(P: Parts, x: number, y: number, z: number, base: number, h: number, st: TempleStyle) {
  const courses = st.kind === "kalinga" ? 12 : 9;
  for (let i = 0; i < courses; i++) {
    const t = i / courses;
    // Parabolic batter: steep at the base, rounding in at the top.
    const s = base * (1 - Math.pow(t, 1.8) * 0.62);
    const ch = h / courses;
    P.box(s, ch * 0.92, s, x, y + ch * (i + 0.5), z, i % 2 ? st.accent : st.stone);
    // Vertical ribs on each face.
    for (const f of [-1, 1]) {
      P.box(s * 0.22, ch, 0.12, x, y + ch * (i + 0.5), z + f * (s / 2 + 0.05), st.stone);
      P.box(0.12, ch, s * 0.22, x + f * (s / 2 + 0.05), y + ch * (i + 0.5), z, st.stone);
    }
  }
  const top = y + h;
  const cap = base * 0.42;
  P.cyl(cap * 0.55, cap * 0.55, cap * 0.25, x, top + cap * 0.12, z, st.stone, 16);
  P.add(new THREE.SphereGeometry(cap * 0.3, 10, 6).scale(1, 0.5, 1).translate(x, top + cap * 0.35, z), st.accent);
  P.cone(cap * 0.12, cap * 0.5, x, top + cap * 0.65, z, GOLD);
  // Flag on a staff.
  P.cyl(0.05, 0.05, cap * 1.6, x, top + cap * 1.2, z, 0x5b3a22, 4);
  P.box(0.05, cap * 0.35, cap * 0.7, x, top + cap * 1.8, z + cap * 0.35, SAFFRON);
}

/** A temple: steps up to a pillared mandapa, the sanctum and its tower
 *  behind. The mandapa is open, so the player can walk in to the door. */
export function temple(w: number, d: number, st: TempleStyle): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  let W = w;
  let D = d;
  if (st.compound) {
    // Compound wall with a gateway; the temple stands inside it.
    const t = 1.2;
    const wh = 4;
    const gate = Math.min(8, w * 0.18);
    const segs: [number, number, number, number][] = [
      [0, -d / 2 + t / 2, w, t],
      [-(w - t) / 2, 0, t, d],
      [(w - t) / 2, 0, t, d],
      [-(w / 2 + gate / 2) / 2, d / 2 - t / 2, w / 2 - gate / 2, t],
      [(w / 2 + gate / 2) / 2, d / 2 - t / 2, w / 2 - gate / 2, t],
    ];
    for (const [x, z, ww, dd] of segs) {
      P.box(ww, wh, dd, x, wh / 2, z, st.stone);
      C.push({ x, z, hw: ww / 2, hd: dd / 2 });
    }
    // Gate towers.
    for (const s of [-1, 1]) P.box(2, wh + 2.5, 2, s * (gate / 2 + 1), (wh + 2.5) / 2, d / 2 - t / 2, st.accent);
    W = w * 0.55;
    D = d * 0.62;
  }
  const rise = st.plinth;
  const pf = platform(P, C, Hs, W, D, rise, st.stone, 0.4);
  const y = rise;

  // Sanctum at the back, tower on it.
  const s = Math.min(W * 0.55, pf.depth * 0.5);
  const sz = pf.top + s / 2 + 0.4;
  const sh = s * 0.55;
  P.box(s, sh, s, 0, y + sh / 2, sz, st.stone);
  P.box(s * 0.28, sh * 0.62, 0.1, 0, y + sh * 0.31, sz + s / 2 + 0.05, DARK);
  C.push({ x: 0, z: sz, hw: s / 2, hd: s / 2 });
  shikhara(P, 0, y + sh, sz, s, Math.max(4, s * st.tower), st);

  // Mandapa in front: pillars under a stepped pyramidal roof.
  const mw = W * 0.8;
  const md = Math.max(3, pf.front - (sz + s / 2) - 0.6);
  const mz = sz + s / 2 + md / 2;
  const ph = Math.min(4, 2.6 + W * 0.05);
  // Corner pillars, and on a wide mandapa two more with a broad bay between
  // them: the way in is down the middle, wide enough to walk through.
  const pillarsX = mw >= 7 ? [-mw / 2 + 0.3, -mw / 4, mw / 4, mw / 2 - 0.3] : [-mw / 2 + 0.3, mw / 2 - 0.3];
  for (const px of pillarsX) {
    for (const pz of [mz - md / 2 + 0.3, mz + md / 2 - 0.3]) {
      P.box(0.35, ph, 0.35, px, y + ph / 2, pz, st.accent);
      C.push({ x: px, z: pz, hw: 0.25, hd: 0.25 });
    }
  }
  P.box(mw + 0.8, 0.4, md + 0.8, 0, y + ph + 0.2, mz, st.stone);
  const tiers = st.kind === "kalinga" ? 5 : 3;
  for (let i = 0; i < tiers; i++) {
    const f = 1 - (i + 1) / (tiers + 1);
    P.box((mw + 0.8) * f, 0.55, (md + 0.8) * f, 0, y + ph + 0.6 + i * 0.6, mz, i % 2 ? st.accent : st.stone);
  }
  // Bell at the door.
  P.cyl(0.02, 0.02, 0.6, 0, y + ph - 0.3, sz + s / 2 + 0.8, 0x3a3a3a, 4);
  P.cone(0.18, 0.3, 0, y + ph - 0.7, sz + s / 2 + 0.8, GOLD, 8);
  // Inside the mandapa, by the sanctum door.
  return finish(P, C, Hs, { x: 0, z: sz + s / 2 + 1.6 });
}

/**
 * A Gujarati (Maru-Gurjara) temple, as the Swaminarayan mandirs and
 * Ahmedabad's old shrines are built: a moulded plinth up a flight of steps,
 * an open hall of carved pillars under a low ghumat dome ringed by small
 * kiosks, balconied windows (jharokhas) on its flanks, and behind it the
 * sanctum's spire clustered with smaller spires (urushringas) climbing its
 * faces, a gilded pot and a saffron flag on each. Marble or sandstone.
 */
export function gurjaraTemple(w: number, d: number, o: { stone: number; trim: number; plinth: number }): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const pf = platform(P, C, Hs, w, d, o.plinth, o.stone, 0.4);
  const y = o.plinth;
  // Mouldings round the plinth.
  for (const k of [0.3, 0.65]) P.box(w + 0.12, 0.12, pf.depth + 0.12, 0, o.plinth * k, pf.zc, o.trim);

  // The sanctum at the back, its spire clustered with smaller spires.
  const s = Math.min(w * 0.42, pf.depth * 0.42);
  const sz = pf.top + s / 2 + 0.4;
  const sh = s * 0.7;
  P.box(s, sh, s, 0, y + sh / 2, sz, o.stone);
  for (const f of [0.25, 0.75]) P.box(s + 0.1, 0.1, s + 0.1, 0, y + sh * f, sz, o.trim);
  C.push({ x: 0, z: sz, hw: s / 2, hd: s / 2 });
  const spire = (x: number, yy: number, z: number, b: number, h: number) => {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const bs = b * (1 - Math.pow(t, 1.6) * 0.7);
      P.box(bs, (h / n) * 0.94, bs, x, yy + (h / n) * (i + 0.5), z, i % 2 ? o.trim : o.stone);
    }
    P.add(new THREE.SphereGeometry(b * 0.22, 10, 6).scale(1, 0.45, 1).translate(x, yy + h + b * 0.06, z), o.trim);
    P.cone(b * 0.08, b * 0.3, x, yy + h + b * 0.2, z, GOLD, 8);
  };
  const H = Math.max(4, s * 1.9);
  spire(0, y + sh, sz, s * 0.95, H);
  // Urushringas: half-height spires on each face, and smaller at the corners.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) spire(dx * s * 0.42, y + sh, sz + dz * s * 0.42, s * 0.42, H * 0.55);
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) spire(dx * s * 0.44, y + sh, sz + dz * s * 0.44, s * 0.26, H * 0.34);
  P.cyl(0.05, 0.05, 1.8, 0, y + sh + H + s * 0.4, sz, 0x5b3a22, 4);
  P.box(0.05, 0.5, 0.9, 0, y + sh + H + s * 0.4 + 0.6, sz + 0.45, SAFFRON);

  // The hall: carved pillars (square shaft, octagonal band, bracket
  // capital) under a beamed roof, open at the front and sides.
  const mw = Math.min(w * 0.82, s * 1.6);
  const md = Math.max(3, pf.front - (sz + s / 2) - 0.4);
  const mz = sz + s / 2 + md / 2;
  const ph = Math.min(3.6, 2.4 + mw * 0.08);
  const xs = mw >= 7 ? [-mw / 2 + 0.3, -mw / 6, mw / 6, mw / 2 - 0.3] : [-mw / 2 + 0.3, mw / 2 - 0.3];
  for (const px of xs) {
    for (const pz of [mz - md / 2 + 0.3, mz + md / 2 - 0.3]) {
      P.box(0.34, ph * 0.55, 0.34, px, y + ph * 0.275, pz, o.stone);
      P.cyl(0.2, 0.2, ph * 0.25, px, y + ph * 0.67, pz, o.trim, 8);
      P.box(0.34, ph * 0.12, 0.34, px, y + ph * 0.86, pz, o.stone);
      P.box(0.8, 0.14, 0.3, px, y + ph * 0.96, pz, o.trim); // bracket capital
      C.push({ x: px, z: pz, hw: 0.2, hd: 0.2 });
    }
  }
  P.box(mw + 0.6, 0.35, md + 0.6, 0, y + ph + 0.17, mz, o.stone);
  P.box(mw + 0.9, 0.12, md + 0.9, 0, y + ph + 0.4, mz, o.trim); // chhajja
  // The ghumat: a low dome on a drum, ringed by small kiosks at the corners.
  const r = Math.min(mw, md) * 0.36;
  P.cyl(r * 1.05, r * 1.05, 0.5, 0, y + ph + 0.7, mz, o.stone, 16);
  P.dome(r, 0, y + ph + 0.95, mz, o.stone, 1);
  P.cone(0.1, 0.45, 0, y + ph + 0.95 + r * 1.3, mz, GOLD, 8);
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const kx = dx * (mw / 2 - 0.3);
    const kz = mz + dz * (md / 2 - 0.3);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(0.08, 0.7, 0.08, kx + a * 0.3, y + ph + 0.8, kz + b * 0.3, o.stone);
    P.dome(0.42, kx, y + ph + 1.15, kz, o.stone, 1);
  }
  // Jharokhas: a balconied window on each flank of the hall.
  for (const sx of [-1, 1]) {
    const jx = sx * (mw / 2 + 0.35);
    P.box(0.7, 0.18, 1.4, jx, y + ph * 0.45, mz, o.trim);
    for (const bz of [-0.55, 0, 0.55]) P.box(0.08, 0.9, 0.08, jx + sx * 0.25, y + ph * 0.45 + 0.54, mz + bz, o.stone);
    P.box(0.8, 0.1, 1.6, jx, y + ph * 0.45 + 1.05, mz, o.trim);
    P.dome(0.45, jx, y + ph * 0.45 + 1.1, mz, o.stone, 1);
  }
  // Bell at the sanctum door.
  P.cyl(0.02, 0.02, 0.5, 0, y + ph - 0.25, sz + s / 2 + 0.6, 0x3a3a3a, 4);
  P.cone(0.16, 0.26, 0, y + ph - 0.6, sz + s / 2 + 0.6, GOLD, 8);
  P.box(s * 0.3, sh * 0.6, 0.08, 0, y + sh * 0.3, sz + s / 2 + 0.04, DARK);
  const m = finish(P, C, Hs, { x: 0, z: sz + s / 2 + 1.4 });
  m.group.name = "gurjara-temple";
  return m;
}

/**
 * A wayside shrine, the kind on every Indian street corner (a Hanuman
 * temple, the Bhagyalaxmi shrine at the Charminar's foot): a small cella
 * painted in sindoor orange or whitewash, a little tower on it, and in
 * front a tin canopy on steel posts hung with brass bells and marigold
 * strings, a couple of steps up, saffron flags on bamboo, a lamp glowing
 * in the doorway.
 */
export function waysideShrine(w: number, d: number, o: { wall: number; roof: number; tower: "curved" | "dome" }): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const s = Math.max(2.2, Math.min(3.6, Math.min(w, d) * 0.45));
  const rise = 0.34;
  const cz = -d / 2 + s / 2 + 0.6;
  // The platform: two steps up (low enough to step on anywhere).
  const pd = Math.min(d - 0.4, s + 3.2);
  const pz = -d / 2 + 0.2 + pd / 2;
  P.box(Math.min(w - 0.4, s + 2.4), rise, pd, 0, rise / 2, pz, 0xd8d0c0);
  P.box(Math.min(w - 0.4, s + 2.4) + 0.4, rise / 2, 0.4, 0, rise / 4, pz + pd / 2 + 0.2, 0xd8d0c0);
  Hs.push({ x: 0, z: pz, hw: Math.min(w - 0.4, s + 2.4) / 2, hd: pd / 2, y0: rise, y1: rise });
  // The cella.
  const ch = s * 0.95;
  P.box(s, ch, s, 0, rise + ch / 2, cz, o.wall);
  P.box(s + 0.2, 0.18, s + 0.2, 0, rise + ch + 0.09, cz, 0xf4efe4);
  P.box(s * 0.42, ch * 0.62, 0.06, 0, rise + ch * 0.31, cz + s / 2 + 0.03, 0x3a1d10);
  P.box(s * 0.2, ch * 0.3, 0.07, 0, rise + ch * 0.2, cz + s / 2 + 0.04, 0xffc94a); // lamp-lit murti
  for (const sx of [-1, 1]) P.box(0.12, ch * 0.7, 0.1, sx * s * 0.26, rise + ch * 0.35, cz + s / 2 + 0.05, 0xf4efe4);
  C.push({ x: 0, z: cz, hw: s / 2, hd: s / 2 });
  // Its tower: a small curved shikhara, or a dome.
  if (o.tower === "curved") {
    // Courses drawing in, all in the shrine's colour, a thin pale band
    // every other one (not stripes: that read as a traffic cone).
    const n = 5;
    const ch2 = s * 0.18;
    for (let i = 0; i < n; i++) {
      const bs = s * 0.78 * (1 - Math.pow(i / n, 1.6) * 0.62);
      const yy = rise + ch + 0.2 + ch2 * (i + 0.5);
      P.box(bs, ch2 * 0.96, bs, 0, yy, cz, o.wall);
      if (i % 2) P.box(bs + 0.06, 0.05, bs + 0.06, 0, yy - ch2 * 0.45, cz, 0xf4efe4);
    }
    const top = rise + ch + 0.2 + ch2 * n;
    P.add(new THREE.SphereGeometry(s * 0.15, 10, 5).scale(1, 0.45, 1).translate(0, top + 0.04, cz), 0xf4efe4);
    P.cone(0.07, 0.3, 0, top + 0.25, cz, GOLD, 6);
  } else {
    P.dome(s * 0.36, 0, rise + ch + 0.18, cz, o.wall, 1.1);
    P.cone(0.07, 0.3, 0, rise + ch + 0.18 + s * 0.55, cz, GOLD, 6);
  }
  // The canopy: corrugated tin sloping to the street, on four steel posts.
  const cw = Math.min(w - 0.6, s + 2);
  const cdp = Math.min(3, pd - s - 0.4);
  const ccz = cz + s / 2 + cdp / 2;
  for (const sx of [-1, 1]) {
    P.cyl(0.05, 0.05, 2.6, sx * (cw / 2 - 0.1), rise + 1.3, ccz + cdp / 2 - 0.1, 0x6f7479, 6);
    C.push({ x: sx * (cw / 2 - 0.1), z: ccz + cdp / 2 - 0.1, hw: 0.08, hd: 0.08 });
  }
  const tin = new THREE.BoxGeometry(cw + 0.4, 0.05, cdp + 0.4).rotateX(0.12);
  P.add(tin.translate(0, rise + 2.75, ccz), o.roof);
  for (let x = -cw / 2; x <= cw / 2; x += 0.3) P.add(new THREE.BoxGeometry(0.04, 0.03, cdp + 0.4).rotateX(0.12).translate(x, rise + 2.79, ccz), 0x5f6a72);
  // Bells along the front beam and marigold strings looped between the posts.
  P.box(cw, 0.08, 0.08, 0, rise + 2.45, ccz + cdp / 2 - 0.1, 0x6f7479);
  for (let x = -cw / 2 + 0.4; x < cw / 2 - 0.2; x += 0.45) {
    P.cyl(0.01, 0.01, 0.25, x, rise + 2.3, ccz + cdp / 2 - 0.1, 0x3a3a3a, 3);
    P.cone(0.07, 0.12, x, rise + 2.12, ccz + cdp / 2 - 0.1, GOLD, 8);
  }
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const x = -cw / 2 + 0.1 + t * (cw - 0.2);
    const sag = Math.sin(Math.PI * t) * 0.35;
    P.add(new THREE.SphereGeometry(0.06, 5, 4).translate(x, rise + 2.35 - sag, ccz + cdp / 2 - 0.05), k % 2 ? 0xf5a623 : 0xe8601c);
  }
  // Saffron flags on bamboo poles at the back corners.
  for (const sx of [-1, 1]) {
    const fx = sx * (s / 2 + 0.35);
    P.cyl(0.03, 0.03, 4.5, fx, rise + 2.25, cz - s / 2 + 0.1, 0xb89a62, 4);
    const flag = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, -0.5), new THREE.Vector2(0.8, -0.25)]));
    P.add(flag.rotateY(-Math.PI / 2).translate(fx, rise + 4.5, cz - s / 2 + 0.1), SAFFRON);
  }
  const m = finish(P, C, Hs, { x: 0, z: ccz });
  m.group.name = "wayside-shrine";
  return m;
}

/* ------------------------------------------------------------------ *
 * Churches
 * ------------------------------------------------------------------ */

export type ChurchStyle = {
  wall: number;
  trim: number;
  roof: number;
  towers: 0 | 1 | 2;
  /** The west front: a plain gable, the stepped Portuguese gable of St
   *  Francis, or Gothic with spires and pinnacles (Santa Cruz). */
  front?: "gable" | "stepped" | "gothic";
};

export function church(w: number, d: number, st: ChurchStyle): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const pf = platform(P, C, Hs, w, d, 0.6, st.trim, 0.3);
  const y = 0.6;
  const nw = Math.min(w * 0.62, 18);
  const nd = pf.depth * 0.82;
  const nz = pf.top + nd / 2 + 0.3;
  const nh = Math.min(12, 5 + nw * 0.4);
  const t = 0.5;
  const fz = nz + nd / 2;
  const bz = nz - nd / 2;
  const doorW = Math.max(2.4, nw * 0.26);
  const WOOD = 0x6b4a2e;

  // Walls: a nave you walk into, not a block. Side walls, the east end
  // behind the altar, and a west front with the door in it.
  for (const sx of [-1, 1]) {
    P.box(t, nh, nd, sx * (nw / 2 - t / 2), y + nh / 2, nz, st.wall);
    C.push({ x: sx * (nw / 2 - t / 2), z: nz, hw: t / 2, hd: nd / 2 });
    // Tall arched windows, coloured glass, inside and out.
    const n = Math.max(2, Math.floor(nd / 4.5));
    for (let k = 0; k < n; k++) {
      const z = bz + 3 + ((nd - 6) * (k + 0.5)) / n;
      for (const face of [1, -1]) {
        const x = sx * (nw / 2 - t / 2) + sx * face * (t / 2 + 0.03);
        P.box(0.05, nh * 0.42, 1.3, x, y + nh * 0.5, z, k % 2 ? 0x3b6fa8 : 0x9b3b5a);
        P.add(new THREE.CylinderGeometry(0.65, 0.65, 0.05, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, y + nh * 0.71, z), k % 2 ? 0x3b6fa8 : 0x9b3b5a);
      }
    }
  }
  P.box(nw, nh, t, 0, y + nh / 2, bz + t / 2, st.wall);
  C.push({ x: 0, z: bz + t / 2, hw: nw / 2, hd: t / 2 });
  const side = (nw - doorW) / 2;
  for (const sx of [-1, 1]) {
    P.box(side, nh, t, sx * (doorW / 2 + side / 2), y + nh / 2, fz - t / 2, st.wall);
    C.push({ x: sx * (doorW / 2 + side / 2), z: fz - t / 2, hw: side / 2, hd: t / 2 });
  }
  // Over the door, and the door leaves standing open.
  P.box(doorW, nh - 3.4, t, 0, y + 3.4 + (nh - 3.4) / 2, fz - t / 2, st.wall);
  for (const sx of [-1, 1]) P.box(0.08, 3.3, doorW / 2, sx * (doorW / 2 + 0.05), y + 1.65, fz + doorW / 4, WOOD);

  // Timber ceiling under a pitched roof.
  P.box(nw - 0.2, 0.2, nd - 0.2, 0, y + nh - 0.1, nz, 0x7a5a3a);
  for (let z = bz + 2; z < fz - 1; z += 3) P.box(nw - 0.3, 0.3, 0.25, 0, y + nh - 0.35, z, WOOD);
  for (const sgn of [-1, 1]) {
    const g = new THREE.BoxGeometry(nw * 0.58, 0.3, nd + 0.6);
    g.rotateZ(sgn * -0.55);
    g.translate(sgn * nw * 0.24, y + nh + nw * 0.14, nz);
    P.add(g, st.roof);
  }

  // Inside: altar on a step at the east end, a cross, candle stands; pews
  // either side of the aisle down the middle.
  const altarZ = bz + t + 2.2;
  P.box(nw - 1.2, 0.3, 3.4, 0, y + 0.15, altarZ, st.trim);
  Hs.push({ x: 0, z: altarZ, hw: (nw - 1.2) / 2, hd: 1.7, y0: y + 0.3, y1: y + 0.3 });
  P.box(2.6, 1.0, 1.0, 0, y + 0.8, bz + t + 1.3, 0xf4efe4);
  P.box(2.7, 0.08, 1.1, 0, y + 1.34, bz + t + 1.3, 0xd4a017);
  C.push({ x: 0, z: bz + t + 1.3, hw: 1.3, hd: 0.5 });
  P.box(0.18, 2.6, 0.12, 0, y + 3.2, bz + t + 0.2, 0xd4a017);
  P.box(1.4, 0.18, 0.12, 0, y + 3.9, bz + t + 0.2, 0xd4a017);
  for (const sx of [-1, 1]) {
    P.cyl(0.06, 0.1, 1.4, sx * 1.8, y + 1.0, bz + t + 1.3, 0xd4a017, 6);
    P.cyl(0.04, 0.04, 0.25, sx * 1.8, y + 1.82, bz + t + 1.3, 0xfff1c2, 6);
  }
  const aisle = Math.max(1.8, doorW * 0.8);
  const pewW = (nw - 2 * t - aisle) / 2 - 0.4;
  if (pewW > 0.8) {
    for (let z = altarZ + 3; z < fz - 3; z += 1.3) {
      for (const sx of [-1, 1]) {
        const x = sx * (aisle / 2 + pewW / 2);
        P.box(pewW, 0.45, 0.45, x, y + 0.45, z, WOOD);
        P.box(pewW, 0.5, 0.08, x, y + 0.85, z - 0.22, WOOD);
        C.push({ x, z, hw: pewW / 2, hd: 0.3 });
      }
    }
  }

  // Façade over the door: pilasters, then the gable of its kind.
  for (const px of [-nw / 2 + 0.3, -doorW / 2 - 0.4, doorW / 2 + 0.4, nw / 2 - 0.3]) P.box(0.5, nh, 0.3, px, y + nh / 2, fz + 0.1, st.trim);
  P.box(nw + 0.4, 0.5, 0.6, 0, y + nh + 0.2, fz, st.trim);
  let crossY: number;
  if (st.front === "stepped") {
    // St Francis: the front rises in steps above the roof, each with a
    // scrolled shoulder, three small windows across, a niche at the top.
    let yy = y + nh + 0.4;
    let fw = nw;
    for (const [k, h] of [[0.84, 2.2], [0.62, 2], [0.38, 1.8]] as const) {
      const nwk = nw * k;
      P.box(nwk, h, 0.6, 0, yy + h / 2, fz - 0.05, st.wall);
      P.box(nwk + 0.3, 0.25, 0.7, 0, yy + h, fz - 0.05, st.trim);
      for (const sx of [-1, 1]) {
        // The scroll: a quarter-round on the step's shoulder.
        const r = (fw - nwk) / 2;
        const q = new THREE.CylinderGeometry(r, r, 0.6, 10, 1, false, 0, Math.PI / 2).rotateX(Math.PI / 2).rotateZ(sx > 0 ? 0 : Math.PI / 2);
        P.add(q.translate(sx * (nwk / 2), yy, fz - 0.05), st.wall);
      }
      yy += h;
      fw = nwk;
    }
    for (const sx of [-1, 0, 1]) archWindow(P, sx * nw * 0.22, y + nh * 0.55, fz + 0.28, Math.max(0.7, nw * 0.07), nh * 0.28, DARK);
    archWindow(P, 0, y + nh + 2.8, fz + 0.28, nw * 0.1, 1.6, DARK);
    crossY = yy + 0.2;
  } else if (st.front === "gothic") {
    // Santa Cruz: a steep gable with a rose window, pointed windows, and
    // pinnacles up the front.
    const tri = new THREE.Shape([new THREE.Vector2(-nw / 2, 0), new THREE.Vector2(nw / 2, 0), new THREE.Vector2(0, nw * 0.5)]);
    P.add(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }).translate(0, y + nh + 0.4, fz - 0.3), st.wall);
    P.add(new THREE.CylinderGeometry(nw * 0.13, nw * 0.13, 0.1, 18).rotateX(Math.PI / 2).translate(0, y + nh + nw * 0.14, fz + 0.26), 0x3b4f7a);
    P.add(new THREE.TorusGeometry(nw * 0.13, 0.12, 6, 18).translate(0, y + nh + nw * 0.14, fz + 0.28), st.trim);
    for (const sx of [-1, 1]) {
      archWindow(P, sx * nw * 0.3, y + nh * 0.35, fz + 0.28, Math.max(0.8, nw * 0.08), nh * 0.5, 0x3b4f7a);
      for (const px of [sx * (nw / 2 - 0.3), sx * (doorW / 2 + 0.4)]) {
        P.cyl(0.18, 0.18, 1.6, px, y + nh + 1.2, fz + 0.1, st.trim, 6);
        P.cone(0.3, 1.4, px, y + nh + 2.7, fz + 0.1, st.trim, 6);
      }
    }
    crossY = y + nh + nw * 0.5 + 0.6;
  } else {
    const tri = new THREE.Shape([new THREE.Vector2(-nw / 2, 0), new THREE.Vector2(nw / 2, 0), new THREE.Vector2(0, nw * 0.32)]);
    P.add(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }).translate(0, y + nh + 0.4, fz - 0.3), st.wall);
    P.add(new THREE.CylinderGeometry(nw * 0.1, nw * 0.1, 0.1, 14).rotateX(Math.PI / 2).translate(0, y + nh * 0.72, fz + 0.06), 0x3b4f7a);
    crossY = y + nh + nw * 0.32 + 0.4;
  }
  P.box(0.15, 1.4, 0.15, 0, crossY + 0.7, fz - 0.05, st.trim);
  P.box(0.8, 0.15, 0.15, 0, crossY + 1, fz - 0.05, st.trim);

  // Towers: a pair flanking the front, or one at the front corner (a
  // Kerala church's bell tower), never across the door.
  const tw = Math.max(3, nw * 0.26);
  const th = nh * 1.7;
  const towerAt: [number, number][] =
    st.towers === 2
      ? [[-(nw / 2 + tw / 2 - 0.4), fz - tw / 2], [nw / 2 + tw / 2 - 0.4, fz - tw / 2]]
      : st.towers === 1
        ? [[nw / 2 + tw / 2 - 0.4, fz - tw / 2]]
        : [];
  for (const [tx, tz] of towerAt) {
    P.box(tw, th, tw, tx, y + th / 2, tz, st.wall);
    for (let k = 1; k <= 3; k++) P.box(tw + 0.3, 0.3, tw + 0.3, tx, y + (th * k) / 4, tz, st.trim);
    P.box(tw * 0.35, tw * 0.6, 0.1, tx, y + th * 0.82, tz + tw / 2 + 0.05, DARK);
    // A Gothic spire is slender and eight-sided, with pinnacles round it.
    const gothic = st.front === "gothic";
    const sh = gothic ? tw * 3.2 : tw * 1.6;
    P.cone(tw * (gothic ? 0.6 : 0.72), sh, tx, y + th + sh / 2, tz, st.roof, gothic ? 8 : 4);
    if (gothic) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cone(0.3, 1.8, tx + (a * tw) / 2.3, y + th + 0.9, tz + (b * tw) / 2.3, st.trim, 6);
    P.box(0.12, 1.1, 0.12, tx, y + th + sh + 0.5, tz, st.trim);
    P.box(0.6, 0.12, 0.12, tx, y + th + sh + 0.75, tz, st.trim);
    C.push({ x: tx, z: tz, hw: tw / 2, hd: tw / 2 });
  }
  // The priest stands before the altar step, facing the door.
  return finish(P, C, Hs, { x: 0, z: altarZ + 2.2 });
}

/* ------------------------------------------------------------------ *
 * Gurdwaras
 * ------------------------------------------------------------------ */

export type GurdwaraStyle = { storeys: number; gold: boolean; nishan: boolean };

/** White (or gilded) storeys with arched windows, a ribbed dome and corner
 *  kiosks; the Nishan Sahib flag outside. */
export function gurdwara(w: number, d: number, st: GurdwaraStyle): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const pf = platform(P, C, Hs, w, d, 0.8, MARBLE, 0.45);
  const y = 0.8;
  const s = Math.min(w * 0.72, pf.depth * 0.72);
  const sz = pf.zc - 0.5;
  const fh = 4.2;
  for (let k = 0; k < st.storeys; k++) {
    const shrink = 1 - k * 0.08;
    const col = st.gold && k > 0 ? GOLD : MARBLE;
    P.box(s * shrink, fh, s * shrink, 0, y + fh * (k + 0.5), sz, col);
    P.box(s * shrink + 0.4, 0.3, s * shrink + 0.4, 0, y + fh * (k + 1), sz, st.gold ? GOLD : 0xe8c85a);
    // Arched openings on every face; a jharokha over the middle one upstairs.
    const half = (s * shrink) / 2;
    for (let q = 0; q < 4; q++) {
      const rot = (q * Math.PI) / 2;
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      for (let a = -1; a <= 1; a++) {
        const u = (a * s * shrink) / 3.4;
        const x = u * c + (half + 0.05) * sn;
        const z = sz - u * sn + (half + 0.05) * c;
        archWindow(P, x, y + fh * k + 0.5, z, s * 0.13, fh * 0.62, DARK, rot);
      }
      if (k > 0) {
        const x = (half + 0.45) * sn;
        const z = sz + (half + 0.45) * c;
        P.box(s * 0.2, 0.15, 0.9, x, y + fh * k + 0.4, z, col, rot);
        P.box(s * 0.2, 0.15, 0.95, x, y + fh * k + fh * 0.8, z, col, rot);
        P.dome(s * 0.07, x, y + fh * k + fh * 0.8 + 0.08, z, GOLD, 1.15);
      }
    }
  }
  const top = y + fh * st.storeys;
  const r = s * 0.28;
  P.cyl(r * 0.9, r * 0.95, 1.2, 0, top + 0.6, sz, st.gold ? GOLD : MARBLE, 16);
  P.dome(r, 0, top + 1.2, sz, GOLD, 1.12);
  P.cyl(0.1, 0.1, r * 0.9, 0, top + 1.2 + r * 1.5 + r * 0.45, sz, GOLD, 6);
  const k = s * 0.38;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chhatri(P, a * k, top, sz + b * k, s * 0.055, st.gold ? GOLD : MARBLE, GOLD);
  // Little gilded domes along the parapet between the corners.
  const ts = s * (1 - (st.storeys - 1) * 0.08);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    for (const u of [-ts * 0.18, 0, ts * 0.18]) {
      const x = dx ? (dx * ts) / 2 - dx * 0.3 : u;
      const z = dz ? sz + (dz * ts) / 2 - dz * 0.3 : sz + u;
      P.cyl(0.18, 0.2, 0.5, x, top + 0.25, z, st.gold ? GOLD : MARBLE, 8);
      P.dome(0.3, x, top + 0.5, z, GOLD, 1.15);
    }
  }
  C.push({ x: 0, z: sz, hw: s / 2, hd: s / 2 });
  if (st.nishan) {
    const nx = w / 2 - 1.5;
    const nz = pf.front - 2;
    P.cyl(0.12, 0.16, 16, nx, y + 8, nz, 0xd9d4c7, 6);
    P.box(0.05, 2, 3, nx, y + 14.6, nz + 1.5, SAFFRON);
    P.cone(0.35, 0.8, nx, y + 16.4, nz, GOLD, 6);
    C.push({ x: nx, z: nz, hw: 0.3, hd: 0.3 });
  }
  return finish(P, C, Hs, { x: 0, z: sz + s / 2 + 1.8 });
}

/** An arched window: a dark opening with a round head, on a face at z. */
export function archWindow(P: Parts, x: number, y: number, z: number, w: number, h: number, col: number, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h - w / 2, 0.08).translate(0, (h - w / 2) / 2, 0);
  const head = new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, h - w / 2, 0);
  for (const geo of [g, head]) P.add(geo.rotateY(rotY).translate(x, y, z), col);
}

/** Four faces of a square block `s` wide centred on (0, cz): calls `f` with
 *  each face's offset along it and the face's rotation. */
function eachFace(s: number, cz: number, f: (px: (u: number) => number, pz: (u: number) => number, rot: number) => void) {
  for (let k = 0; k < 4; k++) {
    const rot = (k * Math.PI) / 2;
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    // Face normal (sin rot, cos rot); along the face (cos rot, -sin rot).
    f((u) => u * c + (sn * s) / 2, (u) => cz - u * sn + (c * s) / 2, rot);
  }
}

/**
 * The Harmandir Sahib: a marble ground storey with a door on every side, a
 * gilded upper storey with arched windows and jharokhas, a parapet of
 * gilded kiosks, and the fluted gold dome on its lotus. It stands on a
 * marble platform in the sarovar; the causeway arrives at the front.
 */
export function harmandir(w: number, d: number): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const rise = 0.3;
  P.box(w, rise, d, 0, rise / 2, 0, MARBLE);
  P.box(w + 0.3, 0.12, d + 0.3, 0, 0.06, 0, 0xd8c3a0);
  Hs.push({ x: 0, z: 0, hw: w / 2, hd: d / 2, y0: rise, y1: rise });
  // A low marble railing round the back and sides; open at the front.
  const rail = (x: number, z: number, lw: number, ld: number) => {
    P.box(lw, 0.7, ld, x, rise + 0.35, z, MARBLE);
    P.box(lw + 0.1, 0.08, ld + 0.1, x, rise + 0.74, z, GOLD);
    C.push({ x, z, hw: lw / 2, hd: ld / 2 });
  };
  rail(0, -d / 2 + 0.15, w, 0.3);
  for (const sx of [-1, 1]) rail(sx * (w / 2 - 0.15), -0.5, 0.3, d - 1);
  const s = Math.min(w, d) * 0.74;
  const sz = -d * 0.08;
  const y = rise;
  // Ground storey: marble, inlaid panels, a door on each side.
  const g1 = 5;
  P.box(s, g1, s, 0, y + g1 / 2, sz, MARBLE);
  eachFace(s, sz, (px, pz, rot) => {
    for (const u of [-s * 0.33, s * 0.33]) P.box(s * 0.2, g1 * 0.62, 0.06, px(u) + Math.sin(rot) * 0.03, y + g1 * 0.46, pz(u) + Math.cos(rot) * 0.03, 0xe6dccb, rot);
    P.box(s * 0.26, 3.7, 0.1, px(0) + Math.sin(rot) * 0.03, y + 1.85, pz(0) + Math.cos(rot) * 0.03, GOLD, rot);
    archWindow(P, px(0) + Math.sin(rot) * 0.06, y, pz(0) + Math.cos(rot) * 0.06, s * 0.18, 3.3, DARK, rot);
  });
  P.box(s + 0.5, 0.35, s + 0.5, 0, y + g1 + 0.1, sz, GOLD);
  // Upper storey, gilded, with arched windows and a jharokha on each face.
  const g2 = 4.4;
  const s2 = s * 0.96;
  const y2 = y + g1 + 0.3;
  P.box(s2, g2, s2, 0, y2 + g2 / 2, sz, GOLD);
  eachFace(s2, sz, (px, pz, rot) => {
    const out = (u: number, o: number): [number, number] => [px(u) + Math.sin(rot) * o, pz(u) + Math.cos(rot) * o];
    for (const u of [-s2 * 0.34, s2 * 0.34]) {
      const [x, z] = out(u, 0.05);
      archWindow(P, x, y2 + 0.9, z, s2 * 0.12, 2.6, 0x6b4a1f, rot);
    }
    const [jx, jz] = out(0, 0.55);
    P.box(s2 * 0.3, 0.2, 1.1, jx, y2 + 0.6, jz, GOLD, rot);
    P.box(s2 * 0.26, 2.2, 0.9, jx, y2 + 1.8, jz, GOLD, rot);
    const [wx, wz] = out(0, 1.02);
    archWindow(P, wx, y2 + 0.9, wz, s2 * 0.16, 2.0, 0x6b4a1f, rot);
    P.box(s2 * 0.32, 0.18, 1.3, jx, y2 + 3.0, jz, GOLD, rot);
    P.dome(s2 * 0.1, jx, y2 + 3.1, jz, GOLD, 1.15);
  });
  // Parapet with little gilded kiosks along it and chhatris at the corners.
  const y3 = y2 + g2;
  P.box(s2 + 0.4, 0.25, s2 + 0.4, 0, y3, sz, 0xc9962c);
  eachFace(s2, sz, (px, pz, rot) => {
    P.box(s2, 0.8, 0.2, px(0), y3 + 0.5, pz(0), GOLD, rot);
    for (const u of [-s2 * 0.25, 0, s2 * 0.25]) chhatri(P, px(u) - Math.sin(rot) * 0.4, y3 + 0.1, pz(u) - Math.cos(rot) * 0.4, 0.32, GOLD, GOLD);
  });
  const k = s2 / 2 - 0.9;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chhatri(P, a * k, y3 + 0.1, sz + b * k, 0.75, GOLD, GOLD);
  // The central pavilion, the lotus and the fluted dome.
  const s3 = s * 0.46;
  P.box(s3, 2.4, s3, 0, y3 + 1.2, sz, GOLD);
  eachFace(s3, sz, (px, pz, rot) => archWindow(P, px(0) + Math.sin(rot) * 0.05, y3 + 0.4, pz(0) + Math.cos(rot) * 0.05, s3 * 0.3, 1.8, 0x6b4a1f, rot));
  const y4 = y3 + 2.4;
  const r = s3 * 0.62;
  P.cyl(r * 0.92, r, 0.6, 0, y4 + 0.3, sz, GOLD, 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    P.add(new THREE.ConeGeometry(0.34, 0.9, 4).rotateX(Math.PI).translate(Math.sin(a) * r * 0.95, y4 + 0.9, sz + Math.cos(a) * r * 0.95), GOLD);
  }
  P.dome(r, 0, y4 + 0.6, sz, GOLD, 1.1);
  // Flutes down the dome.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    P.box(0.08, r * 0.9, 0.08, Math.sin(a) * r * 0.86, y4 + 0.6 + r * 0.45, sz + Math.cos(a) * r * 0.86, 0xc9962c, a);
  }
  const top = y4 + 0.6 + r * 1.5;
  P.cyl(0.08, 0.1, 1.4, 0, top + 0.7, sz, GOLD, 6);
  P.cone(0.5, 0.35, 0, top + 1.2, sz, GOLD, 10);
  P.cyl(0.05, 0.05, 0.8, 0, top + 1.8, sz, GOLD, 5);
  C.push({ x: 0, z: sz, hw: s / 2, hd: s / 2 });
  return finish(P, C, Hs, { x: 0, z: sz + s / 2 + 1.3 });
}

/**
 * The Akal Takht: five storeys over a raised platform, marble arcades below,
 * a gilded storey and a gold dome above, facing the Harmandir Sahib, with
 * the twin Nishan Sahibs (Miri and Piri) before it.
 */
export function akalTakht(w: number, d: number): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const Hs: LocalRect[] = [];
  const rise = 1.2;
  const pf = platform(P, C, Hs, w, d, rise, MARBLE, 0.5);
  const bw = Math.min(w * 0.72, 30);
  const bd = Math.min(pf.depth * 0.55, 12);
  const bz = pf.top + 0.6 + bd / 2;
  const front = bz + bd / 2;
  let y = rise;
  const storeys: { h: number; col: number; win: number; arches: boolean }[] = [
    { h: 4.6, col: MARBLE, win: DARK, arches: true },
    { h: 4.0, col: MARBLE, win: 0x7d6e5c, arches: false },
    { h: 3.8, col: 0xf6eedc, win: 0x7d6e5c, arches: false },
    { h: 3.6, col: GOLD, win: 0x6b4a1f, arches: false },
  ];
  storeys.forEach((st, i) => {
    const sw = bw * (1 - i * 0.05);
    P.box(sw, st.h, bd, 0, y + st.h / 2, bz, st.col);
    const bays = st.arches ? 5 : 7;
    for (let b = 0; b < bays; b++) {
      const x = -sw / 2 + ((b + 0.5) * sw) / bays;
      const aw = st.arches ? (sw / bays) * 0.66 : (sw / bays) * 0.42;
      archWindow(P, x, y + (st.arches ? 0 : 0.6), front + 0.05, aw, st.h * (st.arches ? 0.82 : 0.6), st.win);
    }
    // A chhajja over each storey; a balcony along the second.
    P.box(sw + 0.6, 0.18, bd + 1.2, 0, y + st.h, bz + 0.3, i === 2 ? GOLD : MARBLE);
    if (i === 1) {
      P.box(sw * 0.9, 0.16, 1.2, 0, y + 0.25, front + 0.6, MARBLE);
      P.box(sw * 0.9, 0.8, 0.1, 0, y + 0.65, front + 1.15, GOLD);
    }
    y += st.h;
  });
  // The gilded pavilion on top and its domes.
  const pw = bw * 0.36;
  P.box(pw, 3, bd * 0.6, 0, y + 1.5, bz, GOLD);
  for (let b = 0; b < 3; b++) archWindow(P, -pw / 2 + ((b + 0.5) * pw) / 3, y + 0.4, bz + bd * 0.3 + 0.05, pw * 0.16, 2, 0x6b4a1f);
  const r = pw * 0.36;
  P.cyl(r * 0.9, r * 0.95, 0.8, 0, y + 3.4, bz, GOLD, 16);
  P.dome(r, 0, y + 3.8, bz, GOLD, 1.12);
  P.cyl(0.08, 0.08, 1.4, 0, y + 3.8 + r * 1.5 + 0.7, bz, GOLD, 6);
  for (const a of [-1, 1]) {
    const x = a * bw * 0.34;
    P.cyl(r * 0.5, r * 0.52, 0.5, x, y + 0.25, bz, GOLD, 12);
    P.dome(r * 0.5, x, y + 0.5, bz, GOLD, 1.12);
    chhatri(P, a * (bw * 0.46), y, bz + bd / 2 - 1, 0.7, GOLD, GOLD);
  }
  C.push({ x: 0, z: bz, hw: bw / 2, hd: bd / 2 });
  // Miri and Piri: the twin Nishan Sahibs, before the stair.
  for (const a of [-1, 1]) {
    const nx = a * Math.min(w / 2 - 2, bw * 0.3);
    const nz = pf.front - 2.5;
    P.box(1.6, 0.8, 1.6, nx, rise + 0.4, nz, MARBLE);
    P.cyl(0.2, 0.26, 22, nx, rise + 11.8, nz, SAFFRON, 8);
    P.box(0.05, 2.6, 4, nx, rise + 21, nz + 2, SAFFRON);
    P.cone(0.5, 1.2, nx, rise + 23.4, nz, GOLD, 6);
    C.push({ x: nx, z: nz, hw: 0.8, hd: 0.8 });
  }
  return finish(P, C, Hs, { x: 0, z: front + 2 });
}

/* ------------------------------------------------------------------ *
 * Gates, fountains and other civic pieces
 * ------------------------------------------------------------------ */

/**
 * A gateway of `arches` openings spanning `w` across x (the road runs
 * along z through it). Only the piers collide.
 */
export function gateway(w: number, d: number, arches: number, stone: number, accent: number): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const pier = Math.max(1.8, w * 0.1);
  const open = (w - pier * (arches + 1)) / arches;
  const spring = Math.max(5, open * 0.95);
  const h = spring + open / 2 + 2.6;
  const depth = Math.max(3, d);
  for (let i = 0; i <= arches; i++) {
    const x = -w / 2 + pier / 2 + i * (pier + open);
    P.box(pier, h, depth, x, h / 2, 0, stone);
    P.box(pier + 0.3, 0.5, depth + 0.3, x, 0.25, 0, accent);
    C.push({ x, z: 0, hw: pier / 2, hd: depth / 2 });
    // Buttresses carved in bands, with a little balcony on each face.
    for (const f of [-1, 1]) {
      const z = f * (depth / 2 + 0.25);
      P.box(pier * 0.7, h - 1.6, 0.5, x, (h - 1.6) / 2, z, stone);
      for (const yy of [spring * 0.35, spring * 0.7]) P.box(pier * 0.8, 0.25, 0.6, x, yy, z, accent);
      P.box(pier * 0.9, 0.2, 1.1, x, spring + 0.4, f * (depth / 2 + 0.55), accent);
      for (const sx of [-1, 1]) P.box(0.12, 0.8, 0.12, x + sx * pier * 0.38, spring + 0.9, f * (depth / 2 + 1), accent);
      P.box(pier * 0.9, 0.12, 0.12, x, spring + 1.3, f * (depth / 2 + 1), accent);
    }
    if (i < arches) {
      const cx = x + pier / 2 + open / 2;
      P.add(archedSlab(open, spring, h, depth).translate(cx, 0, 0), stone);
      for (const f of [-1, 1]) {
        // The arch's carved rim and a panel of tracery over it.
        P.add(new THREE.TorusGeometry(open / 2 + 0.1, 0.16, 6, 18, Math.PI).translate(cx, spring, f * (depth / 2 + 0.02)), accent);
        P.box(open * 0.7, 0.9, 0.08, cx, h - 1.3, f * (depth / 2 + 0.04), accent);
      }
    }
  }
  // The terrace on top: a band, crenellations, and little domed turrets.
  P.box(w + 0.6, 0.5, depth + 0.6, 0, h + 0.25, 0, accent);
  const n = Math.max(2, Math.floor(w / 1.4));
  for (let k = 0; k < n; k++) {
    for (const f of [-1, 1]) P.box(0.7, 0.7, 0.3, -w / 2 + (k + 0.5) * (w / n), h + 0.85, f * (depth / 2), stone);
  }
  for (let i = 0; i <= arches; i++) {
    const x = -w / 2 + pier / 2 + i * (pier + open);
    P.cyl(0.45, 0.5, 1.4, x, h + 1.2, 0, stone, 8);
    P.dome(0.55, x, h + 1.9, 0, stone, 1.15);
  }
  return finish(P, C, []);
}

/** Gulzar Houz: an octagonal basin with a tiered fountain, in a roundabout. */
export function fountain(w: number, d: number, stone: number): Monument {
  const P = new Parts();
  const r = Math.min(w, d) * 0.45;
  P.cyl(r, r, 0.7, 0, 0.35, 0, stone, 8);
  P.cyl(r - 0.4, r - 0.4, 0.72, 0, 0.36, 0, WATER, 8);
  for (let k = 0; k < 3; k++) P.cyl(r * (0.3 - k * 0.08), r * (0.34 - k * 0.08), 0.5, 0, 0.9 + k * 0.9, 0, stone, 8);
  P.cone(0.3, 1.2, 0, 3.6, 0, 0xcfe8f2, 6);
  return finish(P, [{ x: 0, z: 0, hw: r * 0.9, hd: r * 0.9 }], []);
}

/** Kabutar Khana: a railed platform round a pillar and a caged cupola, where
 *  the city feeds its pigeons. */
export function kabutarKhana(w: number, d: number): Monument {
  const P = new Parts();
  const r = Math.min(w, d) * 0.45;
  P.cyl(r, r, 0.5, 0, 0.25, 0, 0xd8cfbf, 12);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    P.box(0.08, 0.9, 0.08, Math.cos(a) * r, 0.95, Math.sin(a) * r, 0x2e5a3a);
  }
  P.add(new THREE.TorusGeometry(r, 0.05, 4, 24).rotateX(Math.PI / 2).translate(0, 1.4, 0), 0x2e5a3a);
  // The pavilion in the middle: a ring of eight columns on a raised grain
  // platform, a deep eave, the green dome, and the pigeons' perch rails.
  const pr = Math.min(2.4, r * 0.45);
  P.cyl(pr + 0.6, pr + 0.8, 1, 0, 0.9, 0, 0xe7e1d4, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    P.cyl(0.14, 0.18, 4.2, Math.sin(a) * pr, 1.4 + 2.1, Math.cos(a) * pr, 0xe7e1d4, 8);
  }
  P.cyl(pr + 0.9, pr + 0.9, 0.25, 0, 5.6, 0, 0xe7e1d4, 8);
  P.cyl(pr + 1.3, pr + 0.9, 0.5, 0, 5.95, 0, 0x2e5a3a, 8);
  P.cyl(pr * 0.8, pr * 0.85, 0.8, 0, 6.6, 0, 0xe7e1d4, 8);
  P.dome(pr * 0.9, 0, 7, 0, 0x2e5a3a, 1.12);
  P.cyl(0.05, 0.05, 1.2, 0, 7 + pr * 1.35 + 0.6, 0, 0xd4a017, 5);
  for (const y of [3.2, 4.4]) P.add(new THREE.TorusGeometry(pr, 0.04, 4, 16).rotateX(Math.PI / 2).translate(0, y, 0), 0x2e5a3a);
  // Pigeons on the platform and grain.
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 40; k++) {
    const a = rnd() * Math.PI * 2;
    const rr = 1 + rnd() * (r - 1.4);
    P.add(new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.8, 1.4).rotateY(rnd() * 6).translate(Math.cos(a) * rr, 0.62, Math.sin(a) * rr), rnd() < 0.2 ? 0xf2f2f2 : 0x7c7f8a);
  }
  return finish(P, [{ x: 0, z: 0, hw: r * 0.95, hd: r * 0.95 }], []);
}

/** Colonial block: stuccoed floors with a pillared portico and pediment,
 *  green louvred shutters. Park Street, Fort Kochi. */
/** How a colonial block is dressed: Calcutta's mansion blocks and public
 *  buildings share a vocabulary but not a face. */
export type ColonialDress = {
  /** A pedimented portico on columns at the front. */
  portico?: boolean;
  /** Domed octagonal turrets at the four corners (the Park Street mansions). */
  turrets?: boolean;
  /** Cast-iron balconies on alternate bays of the upper floors. */
  balconies?: boolean;
  /** A colonnade over the footpath along the front (Chowringhee). */
  arcade?: boolean;
  trim?: number;
};

export function colonialBlock(w: number, d: number, floors: number, wall: number, dress: ColonialDress = { portico: true }): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const TRIM = dress.trim ?? 0xf4efe4;
  const IRON = 0x2a2d31;
  const SHUTTER = 0x2f5e3f;
  const fh = 4;
  const h = floors * fh;
  const bw = w * 0.92;
  const bd = d * 0.8;
  const bz = -d / 2 + bd / 2;
  P.box(bw, h, bd, 0, h / 2, bz, wall);
  C.push({ x: 0, z: bz, hw: bw / 2, hd: bd / 2 });
  // Every face, the way Calcutta and Bombay built them: an arcaded ground
  // floor, tall windows with green louvred shutters and hood mouldings
  // above, pilasters between the bays, a string course at each floor.
  const face = (len: number, cx: number, cz: number, rot: number) => {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const at = (u: number, out: number): [number, number] => [cx + u * c + out * sn, cz - u * sn + out * c];
    const n = Math.max(2, Math.floor(len / 3.4));
    const bay = len / n;
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (k + 0.5) * bay;
      const [gx, gz] = at(u, 0.06);
      archWindow(P, gx, 0.2, gz, Math.min(2.4, bay * 0.66), fh * 0.78, 0x4a3c30, rot);
      for (let f = 1; f < floors; f++) {
        const [x, z] = at(u, 0.05);
        P.box(1.1, 2.3, 0.08, x, fh * f + 1.9, z, 0x3a3430, rot);
        for (const s of [-1, 1]) {
          const [sx, sz] = at(u + s * 0.85, 0.08);
          P.box(0.55, 2.3, 0.08, sx, fh * f + 1.9, sz, SHUTTER, rot);
        }
        const [hx, hz] = at(u, 0.14);
        P.box(1.7, 0.22, 0.28, hx, fh * f + 3.2, hz, TRIM, rot);
        P.box(1.4, 0.12, 0.22, hx, fh * f + 0.7, hz, TRIM, rot);
        if (dress.balconies && k % 2 === 0) {
          // A cast-iron balcony: a slab on brackets, a railing of balusters.
          const [bx, bz2] = at(u, 0.5);
          P.box(2.1, 0.12, 0.9, bx, fh * f + 0.6, bz2, TRIM, rot);
          const [rx, rz] = at(u, 0.92);
          P.box(2.1, 0.06, 0.06, rx, fh * f + 1.6, rz, IRON, rot);
          for (let b = -4; b <= 4; b++) {
            const [ix, iz] = at(u + b * 0.24, 0.92);
            P.box(0.03, 0.95, 0.03, ix, fh * f + 1.12, iz, IRON, rot);
          }
          for (const e of [-1, 1]) {
            const [ex, ez] = at(u + e * 1.02, 0.5);
            P.box(0.03, 0.95, 0.85, ex, fh * f + 1.12, ez, IRON, rot);
          }
        }
      }
      const [px, pz] = at(-len / 2 + k * bay, 0.1);
      if (k > 0) P.box(0.35, h - 0.4, 0.2, px, h / 2, pz, TRIM, rot);
    }
    // Quoins at the ends.
    for (const e of [-1, 1]) {
      const [qx, qz] = at((e * len) / 2 - e * 0.3, 0.1);
      P.box(0.6, h, 0.25, qx, h / 2, qz, TRIM, rot);
    }
  };
  face(bw, 0, bz + bd / 2, 0);
  face(bw, 0, bz - bd / 2, Math.PI);
  face(bd, bw / 2, bz, Math.PI / 2);
  face(bd, -bw / 2, bz, -Math.PI / 2);
  for (let f = 1; f < floors; f++) P.box(bw + 0.3, 0.3, bd + 0.3, 0, fh * f, bz, TRIM);
  // The cornice and a balustraded parapet.
  P.box(bw + 0.8, 0.5, bd + 0.8, 0, h + 0.25, bz, TRIM);
  const rail = (len: number, x: number, z: number, along: "x" | "z") => {
    const n = Math.max(4, Math.floor(len / 0.5));
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + (k + 0.5) * (len / n);
      P.cyl(0.1, 0.13, 0.8, along === "x" ? x + t : x, h + 0.9, along === "x" ? z : z + t, TRIM, 6);
    }
    P.box(along === "x" ? len : 0.35, 0.2, along === "x" ? 0.35 : len, x, h + 1.4, z, TRIM);
  };
  rail(bw, 0, bz + bd / 2, "x");
  rail(bw, 0, bz - bd / 2, "x");
  rail(bd, bw / 2, bz, "z");
  rail(bd, -bw / 2, bz, "z");
  // Turrets at the corners: octagonal, a storey above the parapet, domed.
  if (dress.turrets) {
    const r = Math.min(2.4, bw * 0.06, bd * 0.08);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = (sx * bw) / 2;
      const tz = bz + (sz * bd) / 2;
      P.cyl(r, r, h + 3.5, tx, (h + 3.5) / 2, tz, wall, 8);
      for (let f = 1; f <= floors; f++) P.cyl(r + 0.12, r + 0.12, 0.3, tx, fh * f, tz, TRIM, 8);
      P.cyl(r + 0.3, r + 0.3, 0.4, tx, h + 3.7, tz, TRIM, 8);
      P.dome(r * 0.95, tx, h + 3.9, tz, 0x7a8a8c, 1);
      P.cyl(0.06, 0.06, 1.2, tx, h + 3.9 + r * 1.2 + 0.4, tz, IRON, 4);
      C.push({ x: tx, z: tz, hw: r * 0.92, hd: r * 0.92 });
    }
  }
  // A colonnade along the front, over the footpath: columns and a roof that
  // is the first floor's verandah.
  if (dress.arcade) {
    const depth = Math.min(3, d / 2 - (bz + bd / 2) - 0.2);
    if (depth > 1.5) {
      const az = bz + bd / 2 + depth;
      const n = Math.max(3, Math.floor(bw / 4));
      for (let k = 0; k <= n; k++) {
        const x = -bw / 2 + 0.4 + (k * (bw - 0.8)) / n;
        P.cyl(0.26, 0.3, fh, x, fh / 2, az - 0.3, TRIM, 10);
        P.box(0.7, 0.3, 0.7, x, 0.15, az - 0.3, TRIM);
        C.push({ x, z: az - 0.3, hw: 0.3, hd: 0.3 });
      }
      P.box(bw, 0.4, depth + 0.2, 0, fh + 0.2, bz + bd / 2 + depth / 2, TRIM);
      // Its verandah rail above.
      P.box(bw, 0.08, 0.08, 0, fh + 1.3, az - 0.1, IRON);
      for (let x = -bw / 2 + 0.2; x < bw / 2; x += 0.3) P.box(0.04, 0.9, 0.04, x, fh + 0.85, az - 0.1, IRON);
    }
  }
  if (!dress.portico) return finish(P, C, []);
  // Portico.
  const pw = Math.min(bw * 0.5, 14);
  const pz = bz + bd / 2 + 1.6;
  for (let k = 0; k < 6; k++) {
    const x = -pw / 2 + (pw * k) / 5;
    P.cyl(0.3, 0.35, fh * 2, x, fh, pz + 1.1, TRIM, 10);
    P.box(0.9, 0.3, 0.9, x, 0.15, pz + 1.1, TRIM);
    P.box(0.85, 0.3, 0.85, x, fh * 2 - 0.15, pz + 1.1, TRIM);
    C.push({ x, z: pz + 1.1, hw: 0.35, hd: 0.35 });
  }
  P.box(pw + 1, 0.8, 3.4, 0, fh * 2 + 0.4, pz, TRIM);
  const tri = new THREE.Shape([new THREE.Vector2(-pw / 2 - 0.5, 0), new THREE.Vector2(pw / 2 + 0.5, 0), new THREE.Vector2(0, 2.4)]);
  P.add(new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }).translate(0, fh * 2 + 0.8, pz + 1.1), TRIM);
  return finish(P, C, []);
}

/** Jallianwala Bagh: walled garden, the flame memorial and the martyrs' well. */
export function memorialGarden(w: number, d: number): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const t = 1;
  const wh = 3.2;
  const gate = 3;
  const segs: [number, number, number, number][] = [
    [0, -d / 2 + t / 2, w, t],
    [-(w - t) / 2, 0, t, d],
    [(w - t) / 2, 0, t, d],
    [-(w / 2 + gate / 2) / 2, d / 2 - t / 2, w / 2 - gate / 2, t],
    [(w / 2 + gate / 2) / 2, d / 2 - t / 2, w / 2 - gate / 2, t],
  ];
  for (const [x, z, ww, dd] of segs) {
    P.box(ww, wh, dd, x, wh / 2, z, 0xa4553b);
    C.push({ x, z, hw: ww / 2, hd: dd / 2 });
  }
  // Paths and lawns.
  P.box(w - 2, 0.05, d - 2, 0, 0.03, 0, 0x7fb069);
  P.box(3, 0.08, d - 2, 0, 0.05, 0, 0xd9c9a8);
  P.box(w - 2, 0.08, 3, 0, 0.05, 0, 0xd9c9a8);
  // The Flame of Liberty: a slender four-sided red sandstone pylon rising
  // out of a shallow pool, its top opening like a flame.
  const fz = -d * 0.15;
  P.box(14, 0.5, 14, 0, 0.25, fz, 0xc9a882);
  P.box(12.6, 0.52, 12.6, 0, 0.27, fz, 0x3f7fc0);
  P.box(4.4, 1.2, 4.4, 0, 0.6, fz, 0xc9a882);
  const H = 14;
  for (let k = 0; k < 8; k++) {
    const t0 = k / 8;
    const s0 = 2.6 * (1 - t0 * 0.55);
    P.box(s0, H / 8, s0, 0, 1.2 + (k + 0.5) * (H / 8), fz, k % 2 ? 0xa4553b : 0xb5623f);
  }
  // Four petals of flame, splayed.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    P.add(new THREE.ConeGeometry(0.55, 3.2, 4).rotateZ(0.35).rotateY(-a).translate(Math.sin(a) * 0.5, 1.2 + H + 1.3, fz + Math.cos(a) * 0.5), 0xb5623f);
  }
  P.cone(0.5, 3.6, 0, 1.2 + H + 1.8, fz, 0xd9412b, 4);
  C.push({ x: 0, z: fz, hw: 7, hd: 7 });
  // The martyrs' well, under a pavilion, a railing round its mouth.
  const wx = w * 0.28;
  P.cyl(2.4, 2.4, 1.1, wx, 0.55, 0, 0xd9d4c7, 12);
  P.cyl(1.8, 1.8, 1.12, wx, 0.56, 0, 0x1f2a33, 12);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    P.box(0.3, 3.6, 0.3, wx + Math.sin(a) * 3.2, 1.8, Math.cos(a) * 3.2, 0xe8e0d0);
  }
  P.cyl(4, 4, 0.35, wx, 3.7, 0, 0xe8e0d0, 6);
  P.dome(2.6, wx, 3.85, 0, 0xe8e0d0, 1);
  C.push({ x: wx, z: 0, hw: 3.4, hd: 3.4 });
  // The wall that kept the bullet marks, framed in white where they struck.
  const bx = -w / 2 + t + 0.6;
  const bl = Math.min(d * 0.35, 24);
  P.box(1.2, wh + 0.8, bl, bx, (wh + 0.8) / 2, d * 0.1, 0x9a5038);
  let bseed = 11;
  const brnd = () => ((bseed = (bseed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 28; k++) {
    const z = d * 0.1 - bl / 2 + 1 + brnd() * (bl - 2);
    const y = 0.6 + brnd() * (wh - 0.4);
    P.box(0.06, 0.35, 0.35, bx + 0.63, y, z, 0xf4efe4);
    P.box(0.07, 0.18, 0.18, bx + 0.64, y, z, 0x3a2c26);
  }
  C.push({ x: bx, z: d * 0.1, hw: 0.6, hd: bl / 2 });
  return finish(P, C, []);
}

/** A bus terminus: raised bays under long canopies, buses nosed in. */
/** Is a local rectangle (centre, half extents) free of other buildings? */
export type ClearTest = (u: number, v: number, hw: number, hd: number) => boolean;

export function busStation(
  w: number,
  d: number,
  livery: { body: number; stripe: number; upper: number },
  clear: ClearTest = () => true
): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const bays = Math.max(2, Math.floor(w / 14));
  const len = Math.min(d * 0.8, 40);
  // Rows of bays down the whole yard, a driving lane between rows.
  const rows = Math.max(1, Math.floor((d * 0.9) / (len + 12)));
  for (let row = 0; row < rows; row++) {
    const z0 = -((rows - 1) * (len + 12)) / 2 + row * (len + 12);
    for (let b = 0; b < bays; b++) {
      const x = -w / 2 + (w * (b + 0.5)) / bays;
      // The real platform blocks OSM maps inside the yard stay; bays go
      // round them.
      if (!clear(x, z0, 4.6, len / 2 + 1)) continue;
      // Platform, columns and canopy.
      P.box(3, 0.25, len, x, 0.125, z0, 0xcfc9bb);
      for (let k = 0; k <= 4; k++) {
        const z = z0 - len / 2 + (len * k) / 4;
        P.box(0.3, 5, 0.3, x, 2.5, z, 0x6d7076);
        C.push({ x, z, hw: 0.3, hd: 0.3 });
      }
      P.box(9, 0.3, len + 2, x, 5.2, z0, 0xe6e3dc);
      P.box(9.2, 0.5, 0.3, x, 5.2, z0 + len / 2 + 1, livery.body);
      // Benches down the platform.
      for (let k = 0; k < 3; k++) P.box(0.5, 0.45, 3, x, 0.47, z0 - len / 3 + (k * len) / 3, 0x5d6168);
      // Buses nosed in beside the platform, most bays taken.
      for (const side of [-1, 1]) {
        if ((b * 3 + row * 5 + side + 7) % 4 === 0) continue;
        const bx = x + side * 3.2;
        const bl = 11;
        const bz = z0 - len / 2 + bl / 2 + 1 + ((b * 7 + row * 3) % 5);
        parkedBus(P, bx, bz, bl, livery);
        C.push({ x: bx, z: bz, hw: 1.3, hd: bl / 2 });
      }
    }
  }
  return finish(P, C, []);
}

/** A parked bus, nose to local +z: livery bands, a window strip, windscreen,
 *  destination board, wheels. */
export function parkedBus(P: Parts, x: number, z: number, len: number, livery: { body: number; stripe: number; upper: number }) {
  P.box(2.5, 1.05, len, x, 0.95, z, livery.body);
  P.box(2.52, 0.22, len, x, 1.55, z, livery.stripe);
  P.box(2.5, 1.35, len, x, 2.35, z, livery.upper);
  P.box(2.54, 0.8, len - 1.6, x, 2.3, z - 0.3, 0x26303c);
  P.box(2.2, 1.0, 0.06, x, 2.25, z + len / 2 + 0.01, 0x2e3a48);
  P.box(1.8, 0.28, 0.08, x, 2.88, z + len / 2 + 0.02, 0xffb000);
  P.box(2.4, 0.15, len - 0.4, x, 3.1, z, 0xe8e6e0);
  for (const wz of [z + len / 2 - 2, z - len / 2 + 2.4]) {
    for (const sx of [-1.28, 1.28]) {
      P.add(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2).translate(x + sx, 0.5, wz), 0x1f1f22);
    }
  }
}

/**
 * A seafront square (Fort Kochi's Vasco da Gama Square): laterite paving
 * to a stone parapet and iron railing over the water (local -z), a rain
 * tree spreading over a round planter you can sit on, benches facing the
 * sea, the seafood stalls under blue tarps where the catch is laid out on
 * ice to be picked and fried, a tender-coconut cart, and lamp posts.
 */
export function promenade(w: number, d: number): Monument {
  const P = new Parts();
  const C: LocalBox[] = [];
  const rand = mulberry32(Math.round(w * 131 + d * 17));
  const PAVE = 0xa8644a;
  const PAVE_LIGHT = 0xc9a07e;
  const STONE = 0xd8cfbd;
  const IRON = 0x2b2f33;
  const WOOD = 0x8a5a2b;

  // Paving, with lighter bands every couple of metres.
  P.box(w, 0.06, d, 0, 0.03, 0, PAVE);
  for (let x = -w / 2 + 2; x < w / 2; x += 2.2) P.box(0.18, 0.065, d, x, 0.035, 0, PAVE_LIGHT);
  P.box(w, 0.07, 0.35, 0, 0.035, d / 2 - 0.18, PAVE_LIGHT);

  // The sea edge: a stone parapet and an iron railing on it.
  const edge = -d / 2 + 0.3;
  P.box(w, 0.55, 0.5, 0, 0.275, edge, STONE);
  P.box(w + 0.1, 0.08, 0.6, 0, 0.58, edge, 0xe8e1d2);
  for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += 1.2) P.cyl(0.03, 0.03, 0.55, x, 0.88, edge, IRON, 6);
  for (const y of [0.9, 1.14]) P.add(new THREE.CylinderGeometry(0.025, 0.025, w, 6).rotateZ(Math.PI / 2).translate(0, y, edge), IRON);
  C.push({ x: 0, z: edge, hw: w / 2, hd: 0.3 });

  // The rain tree: a thick trunk out of a round laterite planter (a seat
  // all round), its canopy spreading wide and flat.
  const tx = -w * 0.25;
  const tz = -d * 0.08;
  P.cyl(1.3, 1.35, 0.5, tx, 0.25, tz, 0x9a5a3c, 16);
  P.cyl(1.38, 1.38, 0.08, tx, 0.52, tz, 0xc9a07e, 16);
  P.cyl(0.26, 0.38, 3.4, tx, 2.2, tz, 0x5b4331, 8);
  for (const [bx, bz, a] of [[1, 0.3, 0.7], [-0.8, 0.6, -0.6], [0.2, -1, 0.5]]) {
    P.add(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 6).rotateZ(a).rotateY(Math.atan2(bz, bx)).translate(tx + bx * 0.7, 4.1, tz + bz * 0.7), 0x5b4331);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
    const r = i === 0 ? 0 : 1.9 + rand() * 0.9;
    const green = [0x3f7a3a, 0x4a8a3f, 0x356b32][i % 3];
    P.add(new THREE.SphereGeometry(1.9 + rand() * 0.6, 10, 7).scale(1.25, 0.42, 1.25).translate(tx + Math.cos(a) * r, 5.2 + rand() * 0.5, tz + Math.sin(a) * r), green);
  }
  C.push({ x: tx, z: tz, hw: 1.3, hd: 1.3 });

  // Benches facing the water, beside the tree.
  const bench = (x: number, z: number) => {
    P.box(1.7, 0.08, 0.45, x, 0.45, z, WOOD);
    P.box(1.7, 0.4, 0.07, x, 0.72, z - 0.22, WOOD);
    // A concrete body under the slats, as the seafront's benches are built.
    P.box(1.5, 0.41, 0.4, x, 0.205, z, 0xcfc8b8);
    C.push({ x, z, hw: 0.85, hd: 0.25 });
  };
  const benchZ = edge + 1.3;
  for (let x = tx + 2.4; x < w / 2 - 1; x += 2.6) bench(x, benchZ);

  // The seafood stalls along the street side: a table under a blue tarp on
  // four poles, the catch on crushed ice (fish, prawns, a crab or two), a
  // board with the day's prices, a plastic chair.
  const stall = (x: number, z: number) => {
    P.box(2.2, 0.08, 1.1, x, 0.85, z, 0x9aa3a8);
    // A cloth hung all round the table, down to the paving.
    for (const sz of [-1, 1]) P.box(2.2, 0.72, 0.03, x, 0.45, z + sz * 0.56, 0x1f5f8b);
    for (const sx of [-1, 1]) P.box(0.03, 0.72, 1.1, x + sx * 1.1, 0.45, z, 0x1f5f8b);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(0.06, 0.85, 0.06, x + sx * 1.0, 0.42, z + sz * 0.48, IRON);
    P.box(2.0, 0.1, 0.9, x, 0.94, z, 0xeef4f6); // ice
    for (let k = 0; k < 7; k++) {
      const fx = x - 0.8 + k * 0.27;
      P.add(new THREE.SphereGeometry(0.12, 6, 4).scale(2.2, 0.45, 0.8).rotateY(rand() - 0.5).translate(fx, 1.02, z - 0.2 + rand() * 0.35), [0x9fb1bd, 0x7d8e9c, 0xc9a9a0][k % 3]);
    }
    P.add(new THREE.SphereGeometry(0.16, 7, 4).scale(1.2, 0.5, 1).translate(x + 0.6, 1.04, z + 0.25), 0xc0392b); // a crab
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(0.03, 0.03, 2.3, x + sx * 1.25, 1.15, z + sz * 0.8, 0x7a7f84, 5);
    P.add(new THREE.BoxGeometry(2.8, 0.05, 2.0).rotateX(0.08).translate(x, 2.35, z), 0x2a6fb0); // tarp
    P.box(0.7, 0.5, 0.04, x - 0.6, 1.4, z + 0.62, 0xf4efe4); // price board
    P.box(0.45, 0.05, 0.45, x + 0.5, 0.45, z - 1.0, 0xc0392b); // chair
    P.box(0.45, 0.45, 0.05, x + 0.5, 0.68, z - 1.2, 0xc0392b);
    C.push({ x, z, hw: 1.1, hd: 0.55 });
  };
  const stallZ = d / 2 - 1.6;
  const stalls = Math.max(1, Math.floor((w - 3) / 3.4));
  for (let k = 0; k < stalls; k++) stall(-w / 2 + 1.8 + k * 3.4, stallZ);

  // A tender-coconut cart: green nuts heaped on a handcart, the machete's block.
  const cx = w / 2 - 1.4;
  const cz = d * 0.05;
  P.box(1.4, 0.1, 0.9, cx, 0.75, cz, WOOD);
  for (const sx of [-0.55, 0.55]) P.add(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(cx + sx, 0.32, cz + 0.5), 0x3a3d42);
  for (let k = 0; k < 9; k++) P.add(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 1.15, 1).translate(cx - 0.45 + (k % 3) * 0.42, 0.95 + Math.floor(k / 3) * 0.14, cz - 0.25 + ((k * 7) % 3) * 0.22), k % 4 ? 0x5a8f2e : 0x7aa640);
  P.box(0.3, 0.25, 0.3, cx + 0.55, 0.9, cz - 0.3, 0x6a4a2a);
  // Underneath, a crate of more nuts and the cut husks.
  P.box(1.3, 0.45, 0.85, cx, 0.23, cz, 0x7a5a36);
  for (let k = 0; k < 4; k++) P.add(new THREE.SphereGeometry(0.15, 7, 5).translate(cx - 0.45 + k * 0.3, 0.5, cz - 0.1 + (k % 2) * 0.2), 0x6b5a2e);
  C.push({ x: cx, z: cz, hw: 0.75, hd: 0.55 });

  // Lamp posts: a fluted post, a lantern on top.
  for (const [lx, lz] of [[w / 2 - 0.6, edge + 0.9], [-w / 2 + 0.6, d * 0.12]]) {
    P.cyl(0.08, 0.12, 3.6, lx, 1.8, lz, 0x1f3b2e, 8);
    P.cyl(0.18, 0.18, 0.2, lx, 0.1, lz, 0x1f3b2e, 8);
    P.box(0.34, 0.45, 0.34, lx, 3.85, lz, 0xfff0c2);
    P.cone(0.3, 0.25, lx, 4.2, lz, 0x1f3b2e, 4);
    C.push({ x: lx, z: lz, hw: 0.15, hd: 0.15 });
  }
  return finish(P, C, []);
}

/**
 * A bronze on a tiered granite pedestal, in one of the Marina's poses:
 * Kannagi holding up her anklet, Thiruvalluvar the poet with his palm-leaf
 * book, a leader in uniform with a raised arm (Subhas Chandra Bose). The
 * pedestal carries a plaque and a railing round its foot.
 */
/** A tapered limb (or robe, or strap) from `a` to `b`. */
function limb(P: Parts, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, hex: number, seg = 8) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  P.add(g.translate(a.x, a.y, a.z), hex);
}
function ball(P: Parts, x: number, y: number, z: number, r: number, hex: number, sx = 1, sy = 1, sz = 1) {
  P.add(new THREE.SphereGeometry(r, 12, 9).scale(sx, sy, sz).translate(x, y, z), hex);
}

/** A lotus: rings of petals round a cushion, the seat of a figure. */
function lotus(P: Parts, y: number, r: number, hex: number) {
  P.cyl(r * 0.8, r * 0.7, r * 0.3, 0, y + r * 0.15, 0, hex, 16);
  for (const [ring, tilt] of [[1, 0.9], [0.8, 0.5]] as const) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + ring;
      const g = new THREE.SphereGeometry(r * 0.3, 8, 6).scale(0.55, 1, 0.3).rotateX(-tilt).rotateY(-a + Math.PI / 2);
      P.add(g.translate(Math.cos(a) * r * ring * 0.85, y + r * 0.25, Math.sin(a) * r * ring * 0.85), hex);
    }
  }
}

/** A statue on a pedestal inside a railed enclosure, facing +z. The Marina's
 *  row of statues: Kannagi raising her anklet, Thiruvalluvar seated with his
 *  palm-leaf book, Netaji Bose in uniform at the salute. Each figure bronze,
 *  modelled in proportion (jointed limbs, drape, hair), on its own pedestal. */
export type StatuePose = "anklet" | "scholar" | "leader";

export function statue(w: number, d: number, pose: StatuePose = "anklet", figure = 0x5a4a3c, plinth = 0xd8d0c0): Monument {
  const P = new Parts();
  const s = Math.max(3.2, Math.min(w, d) + 1);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const HI = 0x7a6450; // the bronze's worn highlights
  const GILT = 0xc9a44a;
  // The enclosure: a low plinth wall, stone pillars at the corners, iron railings on it.
  const e = (s + 1.2) / 2;
  P.box(s + 1.4, 0.45, s + 1.4, 0, 0.225, 0, 0xc9c1b0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    P.box(0.34, 1.15, 0.34, x * e, 0.58, z * e, 0xd8d0c0);
    P.box(0.42, 0.1, 0.42, x * e, 1.2, z * e, 0xc4bba8);
  }
  for (let k = 1; k < 15; k++) {
    const t = -1 + (k / 15) * 2;
    for (const [x, z] of [[t, 1], [t, -1], [1, t], [-1, t]]) P.box(0.05, 0.7, 0.05, x * e, 0.8, z * e, 0x2e3a33);
  }
  for (const [x, z, lw, ld] of [[0, 1, s + 1.2, 0], [0, -1, s + 1.2, 0], [1, 0, 0, s + 1.2], [-1, 0, 0, s + 1.2]] as const) {
    for (const yy of [0.55, 1.1]) P.box(lw || 0.06, 0.06, ld || 0.06, x * e, yy, z * e, 0x2e3a33);
  }

  // The pedestal: its own for each.
  let y: number;
  if (pose === "scholar") {
    // Broad and low, a carved band, the lotus on top.
    P.box(s, 0.5, s, 0, 0.55, 0, plinth);
    P.box(s * 0.82, 1.8, s * 0.82, 0, 1.7, 0, plinth);
    P.box(s * 0.86, 0.25, s * 0.86, 0, 2.2, 0, 0xc4bba8);
    P.box(s * 0.9, 0.3, s * 0.9, 0, 2.75, 0, plinth);
    P.box(s * 0.4, 0.6, 0.06, 0, 1.5, s * 0.41 + 0.03, 0x6b5a3a);
    y = 2.9;
    lotus(P, y, s * 0.36, figure);
    y += s * 0.2;
  } else if (pose === "leader") {
    // Steps up to a tall shaft with an inscription and a moulded cap.
    P.box(s, 0.35, s, 0, 0.475, 0, plinth);
    P.box(s * 0.85, 0.35, s * 0.85, 0, 0.825, 0, plinth);
    P.box(s * 0.6, 3.2, s * 0.6, 0, 2.6, 0, plinth);
    P.box(s * 0.66, 0.3, s * 0.66, 0, 4.35, 0, 0xc4bba8);
    P.box(s * 0.44, 1.1, 0.06, 0, 2.6, s * 0.3 + 0.03, 0x6b5a3a);
    P.box(s * 0.3, 0.12, 0.07, 0, 3.4, s * 0.3 + 0.04, GILT);
    y = 4.5;
  } else {
    // Tiered, then a tall shaft, a lotus under her feet.
    P.box(s, 0.6, s, 0, 0.6, 0, plinth);
    P.box(s * 0.78, 0.5, s * 0.78, 0, 1.15, 0, plinth);
    P.box(s * 0.56, 3, s * 0.56, 0, 2.9, 0, plinth);
    P.box(s * 0.64, 0.25, s * 0.64, 0, 4.5, 0, 0xc4bba8);
    P.box(s * 0.34, 0.9, 0.06, 0, 2.9, s * 0.28 + 0.03, 0x6b5a3a);
    y = 4.62;
    lotus(P, y, 0.7, figure);
    y += 0.3;
  }

  const k = 1.25; // over life size, as monuments are
  const at = (x: number, yy: number, z: number) => V(x * k, y + yy * k, z * k);
  if (pose === "scholar") {
    // Seated cross-legged: the folded legs, the robe falling over them.
    ball(P, 0, y + 0.22 * k, 0.05 * k, 0.55 * k, figure, 1.35, 0.42, 0.95);
    for (const sx of [-1, 1]) ball(P, sx * 0.34 * k, y + 0.2 * k, 0.4 * k, 0.16 * k, figure, 1.2, 0.7, 1);
    limb(P, at(0, 0.35, 0), at(0, 1.15, -0.02), 0.36 * k, 0.3 * k, figure, 12);
    ball(P, 0, y + 1.12 * k, 0.02 * k, 0.32 * k, figure, 1.25, 0.6, 0.85); // shoulders
    limb(P, at(-0.28, 1.15, 0.05), at(0.3, 0.45, 0.2), 0.08 * k, 0.1 * k, HI); // the shawl across
    limb(P, at(0, 1.2, 0), at(0, 1.35, 0), 0.1 * k, 0.09 * k, figure);
    ball(P, 0, y + 1.5 * k, 0, 0.19 * k, figure, 0.95, 1.1, 1);
    ball(P, 0, y + 1.74 * k, -0.02 * k, 0.1 * k, figure, 1, 0.9, 1); // hair knot
    P.add(new THREE.ConeGeometry(0.13 * k, 0.32 * k, 8).rotateX(Math.PI).translate(0, y + 1.3 * k, 0.1 * k), figure); // beard
    // Left hand holds the palm-leaf book in the lap; the right raised at the chest, teaching.
    limb(P, at(-0.34, 1.08, 0), at(-0.36, 0.72, 0.18), 0.08 * k, 0.07 * k, figure);
    limb(P, at(-0.36, 0.72, 0.18), at(-0.12, 0.62, 0.42), 0.07 * k, 0.06 * k, figure);
    P.add(new THREE.BoxGeometry(0.55 * k, 0.05 * k, 0.12 * k).rotateY(0.3).translate(-0.05 * k, y + 0.62 * k, 0.45 * k), HI);
    limb(P, at(0.34, 1.08, 0), at(0.4, 0.74, 0.2), 0.08 * k, 0.07 * k, figure);
    limb(P, at(0.4, 0.74, 0.2), at(0.3, 1.02, 0.36), 0.07 * k, 0.06 * k, figure);
    ball(P, 0.3 * k, y + 1.06 * k, 0.38 * k, 0.06 * k, figure);
  } else if (pose === "leader") {
    // Boots, breeches, the tunic belted with a strap across, the peaked cap; the salute.
    for (const sx of [-1, 1]) {
      P.box(0.16 * k, 0.12 * k, 0.3 * k, sx * 0.13 * k, y + 0.06 * k, 0.04 * k, 0x2a211a);
      limb(P, at(sx * 0.13, 0.05, 0), at(sx * 0.13, 0.5, 0), 0.085 * k, 0.09 * k, 0x2a211a); // boot
      limb(P, at(sx * 0.13, 0.5, 0), at(sx * 0.12, 0.98, 0), 0.09 * k, 0.12 * k, figure);
    }
    limb(P, at(0, 0.95, 0), at(0, 1.5, 0), 0.23 * k, 0.26 * k, figure, 12);
    ball(P, 0, y + 1.5 * k, 0, 0.27 * k, figure, 1.25, 0.55, 0.8);
    P.cyl(0.25 * k, 0.25 * k, 0.07 * k, 0, y + 1.0 * k, 0, 0x2a211a, 12); // belt
    limb(P, at(-0.2, 1.52, 0.1), at(0.2, 1.0, 0.18), 0.025 * k, 0.025 * k, 0x2a211a); // cross strap
    limb(P, at(0, 1.55, 0), at(0, 1.66, 0), 0.08 * k, 0.075 * k, figure);
    ball(P, 0, y + 1.8 * k, 0.01 * k, 0.15 * k, figure, 0.95, 1.08, 1);
    P.cyl(0.16 * k, 0.15 * k, 0.12 * k, 0, y + 1.96 * k, 0, figure, 12); // cap
    P.add(new THREE.CylinderGeometry(0.1 * k, 0.1 * k, 0.02 * k, 10).scale(1, 1, 0.7).translate(0, y + 1.9 * k, 0.14 * k), 0x2a211a); // peak
    for (const gx of [-0.055, 0.055]) ball(P, gx * k, y + 1.82 * k, 0.13 * k, 0.035 * k, HI); // spectacles
    // Left arm at the side; right up in the salute, fingers to the cap.
    limb(P, at(-0.32, 1.48, 0), at(-0.36, 1.12, 0.02), 0.07 * k, 0.065 * k, figure);
    limb(P, at(-0.36, 1.12, 0.02), at(-0.36, 0.82, 0.06), 0.065 * k, 0.055 * k, figure);
    limb(P, at(0.32, 1.48, 0), at(0.55, 1.62, 0.12), 0.07 * k, 0.065 * k, figure);
    limb(P, at(0.55, 1.62, 0.12), at(0.16, 1.9, 0.14), 0.065 * k, 0.05 * k, figure);
  } else {
    // Kannagi: the sari flaring to her feet, the drape over her left
    // shoulder, hair loose down her back, the anklet raised in her right hand.
    for (const sx of [-1, 1]) P.box(0.12 * k, 0.07 * k, 0.24 * k, sx * 0.1 * k, y + 0.04 * k, 0.12 * k, figure);
    limb(P, at(0, 0.05, 0), at(0, 1.02, 0), 0.4 * k, 0.24 * k, figure, 14);
    limb(P, at(0, 1.0, 0), at(0, 1.42, 0), 0.2 * k, 0.21 * k, figure, 12);
    ball(P, 0, y + 1.3 * k, 0.07 * k, 0.17 * k, figure, 1.3, 0.8, 0.9); // bust
    ball(P, 0, y + 1.44 * k, 0, 0.22 * k, figure, 1.2, 0.5, 0.8); // shoulders
    limb(P, at(0.22, 0.8, 0.16), at(-0.2, 1.46, 0.08), 0.1 * k, 0.07 * k, HI); // the pallu across
    limb(P, at(-0.2, 1.46, -0.02), at(-0.24, 0.7, -0.22), 0.1 * k, 0.16 * k, HI); // falling behind
    limb(P, at(0, 1.48, 0), at(0, 1.58, 0), 0.07 * k, 0.065 * k, figure);
    ball(P, 0, y + 1.7 * k, 0.01 * k, 0.13 * k, figure, 0.9, 1.08, 1);
    limb(P, at(0, 1.72, -0.08), at(0, 1.05, -0.2), 0.14 * k, 0.09 * k, figure); // loose hair
    limb(P, at(-0.25, 1.42, 0), at(-0.3, 1.08, 0.06), 0.06 * k, 0.055 * k, figure);
    limb(P, at(-0.3, 1.08, 0.06), at(-0.26, 0.82, 0.14), 0.055 * k, 0.045 * k, figure);
    limb(P, at(0.25, 1.44, 0), at(0.42, 1.78, 0.04), 0.06 * k, 0.055 * k, figure);
    limb(P, at(0.42, 1.78, 0.04), at(0.46, 2.16, 0.06), 0.055 * k, 0.045 * k, figure);
    P.add(new THREE.TorusGeometry(0.11 * k, 0.03 * k, 6, 14).translate(0.47 * k, y + 2.3 * k, 0.06 * k), GILT);
  }
  return finish(P, [{ x: 0, z: 0, hw: (s + 1.4) / 2, hd: (s + 1.4) / 2 }], []);
}

/**
 * A temple car (ther) parked in its street between festivals: four solid
 * wooden wheels, a carved wooden base in tiers, and above it the frame
 * wrapped in bands of red, white and yellow cloth, a gilt kalasam on top.
 * Long axis along local z.
 */
export function templeCar(w: number, d: number): Monument {
  const P = new Parts();
  const bw = Math.min(w, 6);
  const bd = Math.min(d, 7);
  const WOOD = 0x6b4a2e;
  const DARK_WOOD = 0x4a321f;
  // Wheels, outside the base.
  for (const x of [-bw / 2 - 0.2, bw / 2 + 0.2]) {
    for (const z of [-bd / 2 + 1.2, bd / 2 - 1.2]) {
      P.add(new THREE.CylinderGeometry(1.2, 1.2, 0.45, 14).rotateZ(Math.PI / 2).translate(x, 1.2, z), DARK_WOOD);
      P.add(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 8).rotateZ(Math.PI / 2).translate(x, 1.2, z), 0x8f8f8f);
    }
  }
  // Carved base in tiers, each a little smaller.
  let y = 0.5;
  for (let k = 0; k < 4; k++) {
    const f = 1 - k * 0.08;
    const h = k === 0 ? 1.4 : 0.8;
    P.box(bw * f, h, bd * f, 0, y + h / 2, 0, k % 2 ? WOOD : DARK_WOOD);
    P.box(bw * f + 0.12, 0.12, bd * f + 0.12, 0, y + h, 0, 0xb08a58);
    y += h;
  }
  // Pillars round the deck where the deity rides.
  for (const x of [-bw * 0.32, bw * 0.32]) for (const z of [-bd * 0.32, bd * 0.32]) P.box(0.18, 2.2, 0.18, x, y + 1.1, z, WOOD);
  y += 2.2;
  // The cloth-wrapped tower, tapering, in bands.
  const bands = [0xc0392b, 0xf4efe4, 0xe6b422, 0xc0392b, 0xf4efe4, 0x2e8b57, 0xc0392b];
  let r = Math.min(bw, bd) * 0.46;
  for (const hex of bands) {
    P.cyl(r * 0.88, r, 0.75, 0, y + 0.375, 0, hex, 8);
    y += 0.75;
    r *= 0.86;
  }
  P.cone(r * 1.1, 1.2, 0, y + 0.6, 0, 0xc0392b, 8);
  P.cyl(0.14, 0.2, 0.7, 0, y + 1.45, 0, 0xd4a017, 8);
  // Tow ropes coiled at the front.
  P.add(new THREE.TorusGeometry(0.5, 0.1, 6, 14).rotateX(Math.PI / 2).translate(0, 0.12, bd / 2 + 0.9), 0xc8b08a);
  return finish(P, [{ x: 0, z: 0, hw: bw / 2 + 0.5, hd: bd / 2 + 0.2 }], []);
}
