/**
 * The street's animals, a handful to a district: cows (a zebu's hump and
 * dewlap, horns, in the colours each city's cattle come in) that stand,
 * graze, lie down and amble across the road, and the pariah dogs that trot,
 * sit and sleep in the sun. A cow in the carriageway stops the traffic, the
 * way it really does; a cow is solid, a dog steps aside.
 *
 * Like the crowd they live round the player: when one is left far behind it
 * comes back in somewhere out of sight.
 */

import * as THREE from "three";
import type { Landmark } from "../assets";
import type { MapData } from "./mapData";
import { RoadNet } from "./network";
import { mulberry32 } from "../props";

type Kind = "cow" | "dog";

/** How many of each a district has: very few, and none where they'd be odd. */
export const ANIMALS: Record<Landmark, { cows: number; dogs: number; cowCoats: number[]; dogCoats: number[] }> = {
  delhi: { cows: 3, dogs: 4, cowCoats: [0xe9e4da, 0xcfc8bb, 0x8a7d6c], dogCoats: [0xc49a64, 0x3b3128, 0xe7dccb] },
  mumbai: { cows: 1, dogs: 3, cowCoats: [0xe9e4da, 0x6b4b36], dogCoats: [0xc49a64, 0x2f2a25] },
  chennai: { cows: 3, dogs: 4, cowCoats: [0xe9e4da, 0xb8b0a2], dogCoats: [0xc49a64, 0x3b3128] },
  bengaluru: { cows: 2, dogs: 4, cowCoats: [0xd9d2c5, 0x7b6250], dogCoats: [0xb8895a, 0x2f2a25] },
  kolkata: { cows: 1, dogs: 5, cowCoats: [0xe0d8c8], dogCoats: [0xc49a64, 0x3b3128, 0xe7dccb] },
  hyderabad: { cows: 2, dogs: 4, cowCoats: [0xe9e4da, 0x8a7d6c], dogCoats: [0xc49a64, 0x3b3128] },
  // Kerala's small brown Vechur-coloured cattle.
  kochi: { cows: 2, dogs: 3, cowCoats: [0x7a4a2c, 0x5c3a24], dogCoats: [0xc49a64, 0x2f2a25] },
  ahmedabad: { cows: 3, dogs: 3, cowCoats: [0xe9e4da, 0xcfc8bb], dogCoats: [0xc49a64, 0xe7dccb] },
  amritsar: { cows: 1, dogs: 3, cowCoats: [0xe9e4da, 0x3a3029], dogCoats: [0xc49a64, 0x3b3128] },
  bhubaneswar: { cows: 4, dogs: 3, cowCoats: [0xe9e4da, 0xb8b0a2, 0x8a7d6c], dogCoats: [0xc49a64, 0x3b3128] },
};

const LIVE_RADIUS = 150;
const SPAWN_MIN = 70;
const SPAWN_MAX = 130;

type Mode = "walk" | "stand" | "lie";
type Animal = {
  kind: Kind;
  mesh: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D;
  tail: THREE.Object3D;
  body: THREE.Object3D;
  road: number;
  dir: 1 | -1;
  p: number;
  /** Across the road, left of its a->b line; cows wander into the carriageway. */
  off: number;
  mode: Mode;
  timer: number;
  speed: number;
  phase: number;
  x: number;
  z: number;
  yaw: number;
};

export type Animals = {
  group: THREE.Group;
  prime(focus: THREE.Vector3): void;
  update(dt: number, focus: THREE.Vector3): void;
  /** Cows in or near a carriageway, for the traffic to stop for. */
  inRoad(): { x: number; z: number; r: number }[];
  /** Is a circle at (x, z) inside a cow (dogs step aside)? */
  hit(x: number, z: number, r: number): boolean;
  count: number;
  dispose(): void;
};

function lambert(colour: number, owned: THREE.Material[]) {
  const m = new THREE.MeshLambertMaterial({ color: colour });
  owned.push(m);
  return m;
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** A zebu, facing +z: hump over the shoulders, dewlap, upswept horns. */
function makeCow(coat: number, owned: THREE.Material[], geos: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = lambert(coat, owned);
  const dark = lambert(0x2a221c, owned);
  const horn = lambert(0xd8cdb8, owned);
  const box = (w: number, h: number, d: number) => {
    const b = new THREE.BoxGeometry(w, h, d);
    geos.push(b);
    return b;
  };
  part(box(0.62, 0.62, 1.55), hide, 0, 1.02, 0, body);
  part(box(0.48, 0.3, 0.42), hide, 0, 1.43, 0.42, body); // hump
  const neck = new THREE.Group();
  neck.position.set(0, 1.12, 0.78);
  body.add(neck);
  part(box(0.36, 0.42, 0.5), hide, 0, 0.05, 0.18, neck);
  part(box(0.12, 0.3, 0.36), hide, 0, -0.25, 0.1, neck); // dewlap
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.5);
  neck.add(head);
  part(box(0.3, 0.3, 0.46), hide, 0, 0, 0.12, head);
  part(box(0.24, 0.18, 0.12), dark, 0, -0.06, 0.38, head); // muzzle
  for (const s of [-1, 1]) {
    const h = part(box(0.05, 0.28, 0.05), horn, s * 0.13, 0.26, -0.02, head);
    h.rotation.z = -s * 0.35;
    part(box(0.2, 0.08, 0.12), hide, s * 0.22, 0.06, -0.04, head); // ears
  }
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.75, z);
    body.add(hip);
    part(box(0.14, 0.75, 0.14), hide, 0, -0.375, 0, hip);
    part(box(0.15, 0.08, 0.15), dark, 0, -0.72, 0, hip);
    legs.push(hip);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 1.25, -0.78);
  body.add(tail);
  part(box(0.05, 0.7, 0.05), hide, 0, -0.35, -0.03, tail);
  part(box(0.1, 0.14, 0.08), dark, 0, -0.72, -0.03, tail);
  return { mesh: g, body, legs, head: neck, tail };
}

/** An Indian pariah dog: lean, short coat, curled tail, pricked ears. */
function makeDog(coat: number, owned: THREE.Material[], geos: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = lambert(coat, owned);
  const dark = lambert(0x1c1814, owned);
  const box = (w: number, h: number, d: number) => {
    const b = new THREE.BoxGeometry(w, h, d);
    geos.push(b);
    return b;
  };
  part(box(0.24, 0.24, 0.62), fur, 0, 0.5, 0, body);
  const neck = new THREE.Group();
  neck.position.set(0, 0.58, 0.3);
  body.add(neck);
  part(box(0.2, 0.2, 0.22), fur, 0, 0.1, 0.1, neck);
  part(box(0.12, 0.1, 0.16), fur, 0, 0.05, 0.27, neck); // snout
  part(box(0.05, 0.04, 0.04), dark, 0, 0.08, 0.36, neck); // nose
  for (const s of [-1, 1]) {
    const ear = part(box(0.06, 0.12, 0.04), fur, s * 0.07, 0.24, 0.06, neck);
    ear.rotation.z = -s * 0.2;
  }
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.08, 0.22], [0.08, 0.22], [-0.08, -0.22], [0.08, -0.22]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.42, z);
    body.add(hip);
    part(box(0.06, 0.42, 0.06), fur, 0, -0.21, 0, hip);
    legs.push(hip);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.3);
  body.add(tail);
  const t = part(box(0.05, 0.05, 0.28), fur, 0, 0.1, -0.08, tail);
  t.rotation.x = 0.9; // curled up over the back
  return { mesh: g, body, legs, head: neck, tail };
}

export function createAnimals(map: MapData, landmark: Landmark, groundAt: (x: number, z: number) => number, seed = 7): Animals {
  const spec = ANIMALS[landmark];
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.name = "animals";
  const owned: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  // Anywhere people walk or drive (cows don't keep to footpaths).
  const net = new RoadNet(map, (r) => r.cls !== "steps");
  const roads = net.included().filter((i) => net.roads[i].len > 8);
  const animals: Animal[] = [];
  const add = (kind: Kind) => {
    const coats = kind === "cow" ? spec.cowCoats : spec.dogCoats;
    const m = (kind === "cow" ? makeCow : makeDog)(coats[Math.floor(rand() * coats.length)], owned, geos);
    group.add(m.mesh);
    animals.push({ kind, ...m, road: roads[0], dir: 1, p: 0, off: 0, mode: "stand", timer: 0, speed: 0, phase: rand() * 10, x: 0, z: 0, yaw: 0 });
  };
  for (let i = 0; i < spec.cows; i++) add("cow");
  for (let i = 0; i < spec.dogs; i++) add("dog");

  const choose = (a: Animal) => {
    const r = rand();
    if (a.kind === "cow") {
      // Mostly standing about; now and then a slow amble, or lying down to chew.
      a.mode = r < 0.4 ? "stand" : r < 0.75 ? "walk" : "lie";
      a.timer = a.mode === "lie" ? 25 + rand() * 30 : a.mode === "walk" ? 8 + rand() * 12 : 10 + rand() * 15;
      a.speed = a.mode === "walk" ? 0.45 + rand() * 0.2 : 0;
    } else {
      a.mode = r < 0.5 ? "walk" : r < 0.75 ? "stand" : "lie";
      a.timer = a.mode === "lie" ? 15 + rand() * 25 : a.mode === "walk" ? 5 + rand() * 10 : 4 + rand() * 6;
      a.speed = a.mode === "walk" ? 1.3 + rand() * 0.6 : 0;
    }
  };

  const place = (a: Animal, focus: THREE.Vector3, minDist: number) => {
    for (let tries = 0; tries < 50; tries++) {
      const ri = roads[Math.floor(rand() * roads.length)];
      const road = net.roads[ri];
      const p = rand() * road.len;
      const s = net.along(ri, 1, p);
      const d = Math.hypot(s.x - focus.x, s.z - focus.z);
      if (d < minDist || d > SPAWN_MAX) continue;
      a.road = ri;
      a.dir = rand() < 0.5 ? 1 : -1;
      a.p = a.dir === 1 ? p : road.len - p;
      const half = road.r.w / 2;
      // Cows stand anywhere across the street; dogs keep to its edges.
      a.off = a.kind === "cow" ? (rand() - 0.5) * road.r.w * 0.9 : (rand() < 0.5 ? 1 : -1) * (half + road.r.foot * 0.6);
      choose(a);
      pose(a, 0, true);
      return;
    }
  };

  function pose(a: Animal, dt: number, snap = false) {
    const road = net.roads[a.road];
    if (a.mode === "walk") {
      a.p += a.speed * dt;
      if (a.p >= road.len) {
        // Turn round at the end of the street rather than follow the traffic's turns.
        a.dir = (-a.dir) as 1 | -1;
        a.p = 0;
        a.off = -a.off;
      }
    }
    const s = net.along(a.road, a.dir, a.p);
    const o = a.off * a.dir;
    const tx = s.x + s.dz * o;
    const tz = s.z - s.dx * o;
    if (snap) {
      a.x = tx;
      a.z = tz;
    } else {
      const k = 1 - Math.exp(-dt * 4);
      a.x += (tx - a.x) * k;
      a.z += (tz - a.z) * k;
    }
    const want = Math.atan2(s.dx, s.dz);
    let d = want - a.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.yaw += snap ? d : d * Math.min(1, dt * 2);
    a.mesh.position.set(a.x, groundAt(a.x, a.z), a.z);
    a.mesh.rotation.y = a.yaw;
  }

  function animate(a: Animal, dt: number) {
    a.phase += dt * (a.mode === "walk" ? a.speed * (a.kind === "cow" ? 3.2 : 7) : 1);
    const walking = a.mode === "walk" ? 1 : 0;
    const lying = a.mode === "lie";
    const stride = a.kind === "cow" ? 0.35 : 0.6;
    a.legs.forEach((leg, i) => {
      // Diagonal pairs together, as a walking quadruped's legs go.
      const sign = i === 0 || i === 3 ? 1 : -1;
      leg.rotation.x = lying ? (i < 2 ? -1.3 : 1.3) : Math.sin(a.phase) * stride * walking * sign;
      leg.visible = true;
    });
    const low = a.kind === "cow" ? 0.62 : 0.3;
    a.body.position.y = lying ? -low : 0;
    // Grazing: head down to the ground while standing; up otherwise.
    const graze = a.kind === "cow" && a.mode === "stand" ? 0.75 + Math.sin(a.phase * 0.7) * 0.1 : a.kind === "dog" && a.mode === "stand" ? 0.25 : 0;
    a.head.rotation.x = graze;
    a.tail.rotation.z = Math.sin(a.phase * (a.kind === "dog" && !lying ? 6 : 1.3)) * (a.kind === "dog" ? 0.5 : 0.25);
  }

  return {
    group,
    count: animals.length,
    prime(focus) {
      for (const a of animals) place(a, focus, 12);
    },
    update(dt, focus) {
      for (const a of animals) {
        if (Math.hypot(a.x - focus.x, a.z - focus.z) > LIVE_RADIUS) {
          place(a, focus, SPAWN_MIN);
          continue;
        }
        a.timer -= dt;
        if (a.timer <= 0) choose(a);
        pose(a, dt);
        animate(a, dt);
      }
    },
    inRoad() {
      const out: { x: number; z: number; r: number }[] = [];
      for (const a of animals) {
        if (a.kind !== "cow") continue;
        const road = net.roads[a.road].r;
        if (Math.abs(a.off) < road.w / 2 + 0.5) out.push({ x: a.x, z: a.z, r: 1.1 });
      }
      return out;
    },
    hit(x, z, r) {
      for (const a of animals) {
        if (a.kind !== "cow") continue;
        // The cow as a capsule along its length.
        const c = Math.cos(a.yaw);
        const sn = Math.sin(a.yaw);
        const dx = x - a.x;
        const dz = z - a.z;
        const along = dx * sn + dz * c;
        const across = dx * c - dz * sn;
        const t = Math.max(-0.8, Math.min(1.1, along));
        if (Math.hypot(along - t, across) < r + 0.4) return true;
      }
      return false;
    },
    dispose() {
      owned.forEach((m) => m.dispose());
      geos.forEach((g) => g.dispose());
    },
  };
}
