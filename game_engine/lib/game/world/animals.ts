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

/** A leg: hip and knee joints, and where it falls in the gait (0..1). */
type Leg = { hip: THREE.Object3D; knee: THREE.Object3D; front: boolean; offset: number };

type Rig = {
  mesh: THREE.Group;
  body: THREE.Object3D;
  legs: Leg[];
  neck: THREE.Object3D;
  jaw: THREE.Object3D | null;
  ears: THREE.Object3D[];
  tail: THREE.Object3D[];
};

/** How each animal moves: a cow's four-beat walk, a dog's trot. */
type Gait = {
  /** Share of a stride a foot is on the ground. */
  duty: number;
  /** Leg swing each way, radians. */
  swing: number;
  /** Hip to hoof, metres (for the stride that keeps feet from sliding). */
  leg: number;
  /** How far the body sinks lying down. */
  low: number;
  /** Knee fold (front, hind) when lying: [hipFront, kneeFront, hipHind, kneeHind]. */
  fold: [number, number, number, number];
  /** Fastest turn, rad/s. */
  turn: number;
};

const GAIT: Record<Kind, Gait> = {
  cow: { duty: 0.66, swing: 0.3, leg: 0.8, low: 0.6, fold: [-1.45, 2.9, -1.3, 2.3], turn: 0.7 },
  dog: { duty: 0.45, swing: 0.45, leg: 0.42, low: 0.3, fold: [-1.45, 0.1, -1.35, 0.2], turn: 2.5 },
};

type Animal = Rig & {
  kind: Kind;
  road: number;
  dir: 1 | -1;
  p: number;
  /** Across the road, left of its a->b line; cows wander into the carriageway. */
  off: number;
  mode: Mode;
  timer: number;
  /** The pace it's making for, and the pace it's at (it eases in and out of a walk). */
  speed: number;
  pace: number;
  /** Where in the stride it is, 0..1. */
  cycle: number;
  /** 0 standing .. 1 lying, eased: going down front first, getting up hind first. */
  lie: number;
  /** Where the head is and where it's going: grazing, looking about, at the player. */
  look: { pitch: number; yaw: number; toPitch: number; toYaw: number; timer: number; grazing: boolean; atPlayer: boolean };
  ear: { timer: number; side: number; t: number };
  swish: { timer: number; amp: number; t: number };
  t: number;
  x: number;
  z: number;
  yaw: number;
  yawRate: number;
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

/** Geometry and placement shorthands for building the models. */
function kit(geos: THREE.BufferGeometry[]) {
  const keep = <G extends THREE.BufferGeometry>(g: G) => (geos.push(g), g);
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D,
    at: [number, number, number],
    o: { rot?: [number, number, number]; scale?: [number, number, number] } = {}
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...at);
    if (o.rot) m.rotation.set(...o.rot);
    if (o.scale) m.scale.set(...o.scale);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (parent: THREE.Object3D, at: [number, number, number]) => {
    const g = new THREE.Group();
    g.position.set(...at);
    parent.add(g);
    return g;
  };
  return {
    ball: (r: number) => keep(new THREE.SphereGeometry(r, 14, 10)),
    /** A capsule lying along z. */
    pill: (r: number, len: number) => keep(new THREE.CapsuleGeometry(r, len, 5, 12).rotateX(Math.PI / 2)),
    /** A tapered limb hanging down from its joint. */
    limb: (top: number, bottom: number, len: number) => keep(new THREE.CylinderGeometry(top, bottom, len, 10).translate(0, -len / 2, 0)),
    horn: (r: number, len: number) => keep(new THREE.ConeGeometry(r, len, 8).translate(0, len / 2, 0)),
    add,
    joint,
  };
}

/** A shade of a coat, for the parts that are darker (or lighter) on the animal. */
const tone = (coat: number, k: number) => new THREE.Color(coat).multiplyScalar(k).getHex();

/**
 * A zebu, facing +z: a deep barrel on fine legs, the hump over the
 * shoulders, a loose dewlap, bony hips, a long face with drooping ears and
 * upswept horns, and a thin tail with a dark switch.
 */
function makeCow(coat: number, owned: THREE.Material[], geos: THREE.BufferGeometry[]): Rig {
  const k = kit(geos);
  const mesh = new THREE.Group();
  const body = k.joint(mesh, [0, 0, 0]);
  const hide = lambert(coat, owned);
  // Zebu are darker over the hump and shoulders, lighter underneath.
  const shoulder = lambert(tone(coat, 0.9), owned);
  const dark = lambert(0x221b16, owned);
  const muzzle = lambert(tone(coat, 0.45), owned);
  const horn = lambert(0xcbbd9f, owned);

  k.add(k.pill(0.37, 0.88), hide, body, [0, 1.0, -0.02], { scale: [0.84, 1.08, 1] });
  k.add(k.ball(0.37), shoulder, body, [0, 1.04, 0.42], { scale: [0.86, 1.02, 0.9] }); // chest and shoulders
  // The hump rises from the withers and slopes away behind.
  k.add(k.ball(0.22), shoulder, body, [0, 1.28, 0.4], { rot: [0.5, 0, 0], scale: [0.85, 0.95, 1.35] });
  for (const s of [-1, 1]) k.add(k.ball(0.09), hide, body, [s * 0.15, 1.24, -0.5], { scale: [1, 0.7, 1.5] }); // hip bones
  k.add(k.ball(0.3), hide, body, [0, 1.06, -0.52], { scale: [0.9, 0.95, 0.8] }); // rump

  const neck = k.joint(body, [0, 1.16, 0.66]);
  neck.rotation.order = "YXZ";
  k.add(k.pill(0.17, 0.3), shoulder, neck, [0, 0.02, 0.18], { rot: [-0.35, 0, 0], scale: [0.9, 1.1, 1] });
  k.add(k.ball(0.2), hide, neck, [0, -0.22, 0.12], { scale: [0.3, 1, 1.25] }); // dewlap, hanging
  const head = k.joint(neck, [0, 0.14, 0.42]);
  head.rotation.x = 0.55; // a cow carries its face long and down
  k.add(k.pill(0.13, 0.32), hide, head, [0, 0, 0.14], { scale: [1, 1.05, 1] });
  k.add(k.ball(0.15), hide, head, [0, 0.04, -0.02], { scale: [1.05, 1, 0.9] }); // poll and forehead
  k.add(k.ball(0.12), muzzle, head, [0, -0.02, 0.4], { scale: [1, 0.85, 0.8] });
  for (const s of [-1, 1]) k.add(k.ball(0.022), dark, head, [s * 0.075, -0.02, 0.48]); // nostrils
  const jaw = k.joint(head, [0, -0.08, 0.16]);
  k.add(k.pill(0.075, 0.2), muzzle, jaw, [0, -0.03, 0.12], { scale: [1, 0.8, 1] });
  const ears: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    k.add(k.ball(0.028), dark, head, [s * 0.12, 0.07, 0.12]); // eyes
    // Horns: up and out from the poll, curving back in at the tips.
    const base = k.joint(head, [s * 0.1, 0.13, -0.04]);
    base.rotation.set(-0.35, 0, -s * 0.55);
    k.add(k.horn(0.04, 0.16), horn, base, [0, 0, 0]);
    const tip = k.joint(base, [0, 0.15, 0]);
    tip.rotation.set(-0.2, 0, s * 0.6);
    k.add(k.horn(0.026, 0.13), horn, tip, [0, 0, 0]);
    // Ears: long, hanging out to the side (they flick at flies).
    const ear = k.joint(head, [s * 0.15, 0.04, 0.02]);
    ear.rotation.z = -s * 0.5;
    k.add(k.ball(0.12), hide, ear, [s * 0.1, 0, 0], { scale: [1, 0.3, 0.55] });
    ears.push(ear);
  }

  const legs: Leg[] = [];
  // Left front, right front, left hind, right hind; a walk's footfalls go LH, LF, RH, RF.
  for (const [x, z, front, offset] of [[-0.19, 0.5, true, 0.25], [0.19, 0.5, true, 0.75], [-0.19, -0.5, false, 0], [0.19, -0.5, false, 0.5]] as const) {
    const hip = k.joint(body, [x, 0.84, z]);
    k.add(k.ball(front ? 0.13 : 0.15), front ? shoulder : hide, hip, [0, 0.02, 0], { scale: [0.8, 1.3, 1] });
    k.add(k.limb(front ? 0.1 : 0.12, 0.06, 0.42), hide, hip, [0, 0, 0]);
    const knee = k.joint(hip, [0, -0.42, 0]);
    k.add(k.ball(0.06), hide, knee, [0, 0, 0]);
    k.add(k.limb(0.05, 0.045, 0.32), hide, knee, [0, 0, 0]);
    k.add(k.limb(0.055, 0.065, 0.07), dark, knee, [0, -0.31, 0.01]); // hoof
    if (!front) {
      // The hind leg's zig: thigh forward, hock back.
      hip.rotation.x = -0.12;
      knee.rotation.x = 0.22;
    }
    legs.push({ hip, knee, front, offset });
  }

  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = k.joint(body, [0, 1.3, -0.74]);
  tail.push(parent);
  parent.rotation.x = 0.3;
  for (let i = 0; i < 3; i++) {
    k.add(k.limb(0.028, 0.022, 0.24), hide, parent, [0, 0, 0]);
    if (i < 2) {
      parent = k.joint(parent, [0, -0.24, 0]);
      tail.push(parent);
    }
  }
  k.add(k.ball(0.06), dark, parent, [0, -0.3, 0], { scale: [0.8, 1.6, 0.8] }); // switch

  return { mesh, body, legs, neck, jaw, ears, tail };
}

/** An Indian pariah dog: lean and deep-chested, a wedge of a head, pricked ears, the tail curled over the back. */
function makeDog(coat: number, owned: THREE.Material[], geos: THREE.BufferGeometry[]): Rig {
  const k = kit(geos);
  const mesh = new THREE.Group();
  const body = k.joint(mesh, [0, 0, 0]);
  const fur = lambert(coat, owned);
  const pale = lambert(tone(coat, 1.15), owned);
  const dark = lambert(0x1c1814, owned);

  k.add(k.pill(0.13, 0.36), fur, body, [0, 0.52, -0.02], { scale: [0.85, 1, 1] });
  k.add(k.ball(0.15), pale, body, [0, 0.5, 0.18], { scale: [0.85, 1.05, 1] }); // chest
  const neck = k.joint(body, [0, 0.6, 0.26]);
  neck.rotation.order = "YXZ";
  k.add(k.pill(0.07, 0.12), fur, neck, [0, 0.05, 0.05], { rot: [-0.8, 0, 0] });
  const head = k.joint(neck, [0, 0.14, 0.1]);
  k.add(k.ball(0.09), fur, head, [0, 0, 0], { scale: [1, 0.95, 1.1] });
  k.add(k.pill(0.045, 0.1), fur, head, [0, -0.025, 0.12]); // muzzle
  k.add(k.ball(0.022), dark, head, [0, -0.01, 0.23]); // nose
  const jaw = k.joint(head, [0, -0.05, 0.04]);
  k.add(k.pill(0.03, 0.09), pale, jaw, [0, -0.005, 0.08]);
  const ears: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    k.add(k.ball(0.014), dark, head, [s * 0.045, 0.03, 0.08]);
    const ear = k.joint(head, [s * 0.05, 0.07, -0.01]);
    ear.rotation.z = -s * 0.25;
    k.add(k.horn(0.035, 0.09), fur, ear, [0, 0, 0], { scale: [1, 1, 0.45] });
    ears.push(ear);
  }
  const legs: Leg[] = [];
  // A trot: diagonal pairs together.
  for (const [x, z, front, offset] of [[-0.07, 0.2, true, 0], [0.07, 0.2, true, 0.5], [-0.07, -0.2, false, 0.5], [0.07, -0.2, false, 0]] as const) {
    const hip = k.joint(body, [x, 0.44, z]);
    k.add(k.limb(front ? 0.04 : 0.05, 0.028, 0.22), fur, hip, [0, 0, 0]);
    const knee = k.joint(hip, [0, -0.22, 0]);
    k.add(k.limb(0.025, 0.022, 0.2), front ? pale : fur, knee, [0, 0, 0]);
    k.add(k.ball(0.028), pale, knee, [0, -0.2, 0.015], { scale: [1, 0.6, 1.3] }); // paw
    if (!front) {
      hip.rotation.x = -0.2;
      knee.rotation.x = 0.35;
    }
    legs.push({ hip, knee, front, offset });
  }
  // The curl: three joints bending up and over.
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = k.joint(body, [0, 0.58, -0.22]);
  for (let i = 0; i < 3; i++) {
    tail.push(parent);
    parent.rotation.x = i === 0 ? -2.2 : -0.7;
    k.add(k.limb(0.035 - i * 0.006, 0.03 - i * 0.006, 0.1), fur, parent, [0, 0, 0]);
    parent = k.joint(parent, [0, -0.1, 0]);
  }
  return { mesh, body, legs, neck, jaw, ears, tail };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

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
    const rig = (kind === "cow" ? makeCow : makeDog)(coats[Math.floor(rand() * coats.length)], owned, geos);
    group.add(rig.mesh);
    animals.push({
      kind,
      ...rig,
      road: roads[0],
      dir: 1,
      p: 0,
      off: 0,
      mode: "stand",
      timer: 0,
      speed: 0,
      pace: 0,
      cycle: rand(),
      lie: 0,
      look: { pitch: 0, yaw: 0, toPitch: 0, toYaw: 0, timer: 0, grazing: false, atPlayer: false },
      ear: { timer: rand() * 4, side: 0, t: 9 },
      swish: { timer: rand() * 5, amp: 0, t: 0 },
      t: rand() * 10,
      x: 0,
      z: 0,
      yaw: 0,
      yawRate: 0,
    });
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
    // It walks only once it's up, and eases into and out of its pace.
    const wantPace = a.mode === "walk" && a.lie < 0.05 ? a.speed : 0;
    a.pace = snap ? wantPace : damp(a.pace, wantPace, a.kind === "cow" ? 1.2 : 3, dt);
    a.p += a.pace * dt;
    if (a.p >= road.len) {
      // At the end of the street it turns round (on the same side) and stands a while first.
      a.dir = (-a.dir) as 1 | -1;
      a.p = 0;
      a.mode = "stand";
      a.timer = 3 + rand() * 4;
    }
    const s = net.along(a.road, a.dir, a.p);
    const o = a.off * a.dir;
    const tx = s.x + s.dz * o;
    const tz = s.z - s.dx * o;
    if (snap) {
      a.x = tx;
      a.z = tz;
    } else {
      const k = 1 - Math.exp(-dt * 3);
      a.x += (tx - a.x) * k;
      a.z += (tz - a.z) * k;
    }
    let d = Math.atan2(s.dx, s.dz) - a.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // Lying down it stays as it is; otherwise it turns at an animal's pace, not a turret's.
    const turn = snap ? d : a.lie > 0.05 ? 0 : Math.max(-GAIT[a.kind].turn * dt, Math.min(GAIT[a.kind].turn * dt, d * Math.min(1, dt * 2.5)));
    a.yaw += turn;
    a.yawRate = dt > 0 ? turn / dt : 0;
    a.mesh.position.set(a.x, groundAt(a.x, a.z), a.z);
    a.mesh.rotation.y = a.yaw;
  }

  /** Where the head goes next: bouts of grazing and of looking about, and at you when you're close. */
  function nextLook(a: Animal, focus: THREE.Vector3) {
    const l = a.look;
    const dx = focus.x - a.x;
    const dz = focus.z - a.z;
    const near = Math.hypot(dx, dz) < (a.kind === "cow" ? 9 : 12);
    let rel = Math.atan2(dx, dz) - a.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    l.atPlayer = near && Math.abs(rel) < 2 && rand() < 0.7;
    l.grazing = false;
    if (a.mode === "walk") {
      l.toPitch = a.kind === "cow" ? 0.15 : 0.1;
      l.toYaw = (rand() - 0.5) * 0.3;
      l.timer = 2 + rand() * 3;
    } else if (a.mode === "lie") {
      l.toPitch = a.kind === "cow" ? -0.05 : 0.45;
      l.toYaw = (rand() - 0.5) * 1.2;
      l.timer = 4 + rand() * 6;
    } else if (a.kind === "cow" && !l.atPlayer && rand() < 0.65) {
      l.grazing = true;
      l.toPitch = 0.95;
      l.toYaw = (rand() - 0.5) * 0.6;
      l.timer = 4 + rand() * 7;
    } else {
      l.toPitch = a.kind === "cow" ? 0.05 + rand() * 0.15 : -0.1 + rand() * 0.3;
      l.toYaw = (rand() - 0.5) * 1.1;
      l.timer = 2 + rand() * 4;
    }
    if (l.atPlayer) {
      l.toYaw = Math.max(-1, Math.min(1, rel));
      l.toPitch = Math.min(l.toPitch, 0.1);
      l.timer = 2 + rand() * 3;
    }
  }

  function animate(a: Animal, dt: number, focus: THREE.Vector3) {
    const g = GAIT[a.kind];
    a.t += dt;

    // Lying down and getting up: a cow goes down on its front knees first,
    // then the hind end; it gets up hind end first. A dog just drops.
    const wantLie = a.mode === "lie" && a.pace < 0.05 ? 1 : 0;
    a.lie = damp(a.lie, wantLie, a.kind === "cow" ? 0.9 : 2.5, dt);
    const frontDown = smooth(0, 0.6, a.lie);
    const hindDown = smooth(0.35, 1, a.lie);

    // The stride: its rate set by the pace so a foot on the ground stays put;
    // a turn on the spot is stepped round, not spun.
    const shuffle = Math.abs(a.yawRate) * (a.kind === "cow" ? 0.7 : 0.25);
    const v = Math.max(a.pace, shuffle);
    a.cycle = (a.cycle + (v * g.duty * dt) / (2 * g.leg * Math.sin(g.swing))) % 1;
    const w = Math.min(1, v / (a.kind === "cow" ? 0.25 : 0.5)) * (1 - a.lie);

    for (const leg of a.legs) {
      const u = (a.cycle + leg.offset) % 1;
      let swing: number;
      let lift = 0;
      if (u < g.duty) swing = g.swing * (1 - (2 * u) / g.duty);
      else {
        const f = (u - g.duty) / (1 - g.duty);
        swing = -g.swing + 2 * g.swing * f * f * (3 - 2 * f);
        lift = Math.sin(Math.PI * f);
      }
      // rotation.x > 0 swings the foot back; the stride runs forward to back.
      const stand = leg.front ? [0, 0] : a.kind === "cow" ? [-0.12, 0.22] : [-0.2, 0.35];
      const down = leg.front ? frontDown : hindDown;
      const [hipLie, kneeLie] = leg.front ? [g.fold[0], g.fold[1]] : [g.fold[2], g.fold[3]];
      const hipWalk = stand[0] - swing * w - lift * w * (leg.front ? 0.15 : 0.05);
      const kneeWalk = stand[1] + lift * w * (leg.front ? 0.95 : 0.7);
      leg.hip.rotation.x = hipWalk + (hipLie - hipWalk) * down;
      leg.knee.rotation.x = kneeWalk + (kneeLie - kneeWalk) * down;
      // Lying, the hind legs go out to one side.
      leg.hip.rotation.z = leg.front ? 0 : hindDown * (a.kind === "cow" ? 0.35 : 0.2) * (leg.hip.position.x > 0 ? 1 : -1);
    }

    // The body: sinking as it lies (front first), a walk's bob and sway,
    // and breathing, slower and deeper lying down.
    const bob = Math.cos(a.cycle * Math.PI * 4) * (a.kind === "cow" ? 0.02 : 0.015) * w;
    a.body.position.y = -g.low * (frontDown + hindDown) * 0.5 + bob;
    a.body.rotation.x = (frontDown - hindDown) * (a.kind === "cow" ? 0.28 : 0.1);
    a.body.rotation.z = Math.sin(a.cycle * Math.PI * 2) * 0.025 * w + hindDown * 0.08;
    const breath = 1 + Math.sin(a.t * (a.lie > 0.5 ? 1.4 : 1.9)) * (a.kind === "cow" ? 0.012 : 0.02);
    a.body.scale.set(breath, 1, 1);

    // The head: eases toward where it's looking; grazing, it nibbles and steps its muzzle along.
    const l = a.look;
    l.timer -= dt;
    if (l.timer <= 0) nextLook(a, focus);
    if (l.atPlayer) {
      let rel = Math.atan2(focus.x - a.x, focus.z - a.z) - a.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      l.toYaw = Math.max(-1, Math.min(1, rel));
    }
    const headRate = a.kind === "cow" ? 1.6 : 4;
    l.pitch = damp(l.pitch, l.toPitch, headRate, dt);
    l.yaw = damp(l.yaw, l.toYaw, headRate * 0.8, dt);
    const nod = Math.sin(a.cycle * Math.PI * 4) * 0.07 * w;
    const nibble = l.grazing ? Math.max(0, Math.sin(a.t * 2.3)) * 0.08 + Math.sin(a.t * 0.37) * 0.12 : 0;
    a.neck.rotation.x = l.pitch + nod + nibble;
    a.neck.rotation.y = l.yaw + (l.grazing ? Math.sin(a.t * 0.29) * 0.25 : 0);

    // Chewing: always, for a cow; a dog's jaw only moves when it pants.
    if (a.jaw) {
      a.jaw.rotation.x =
        a.kind === "cow"
          ? (l.grazing || a.lie > 0.5 ? 1 : 0.3) * (0.06 + Math.sin(a.t * 5.5) * 0.06)
          : a.pace > 1 || (a.mode === "stand" && a.t % 20 < 8) ? 0.25 + Math.sin(a.t * 14) * 0.08 : 0;
    }

    // An ear flicks, now and then; a dog's prick up when you're near.
    const e = a.ear;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = (a.kind === "cow" ? 1.5 : 3) + rand() * 5;
      e.side = rand() < 0.5 ? 0 : 1;
      e.t = 0;
    }
    e.t += dt;
    const flick = Math.exp(-e.t * 9) * Math.sin(e.t * 40) * 0.5;
    a.ears.forEach((ear, i) => {
      const s = i === 0 ? -1 : 1;
      const base = a.kind === "cow" ? -s * 0.5 : -s * 0.25;
      ear.rotation.z = base + (i === e.side ? flick * s : 0);
      ear.rotation.x = i === e.side ? Math.abs(flick) * 0.6 : 0;
    });

    // The tail: a cow's hangs and swishes at flies in bouts, the swing running down it;
    // a dog's curl wags when it trots or when you're about.
    const sw = a.swish;
    sw.timer -= dt;
    if (sw.timer <= 0) {
      sw.timer = 3 + rand() * 8;
      sw.amp = a.kind === "cow" ? 0.35 + rand() * 0.35 : 0.25 + rand() * 0.2;
    }
    sw.amp = damp(sw.amp, 0, a.kind === "cow" ? 0.6 : 0.3, dt);
    sw.t += dt;
    if (a.kind === "cow") {
      a.tail.forEach((seg, i) => {
        seg.rotation.z = Math.sin(sw.t * 2.4 - i * 0.7) * sw.amp * (0.6 + i * 0.35);
        // Lying, it drops to the ground and the end lies out behind.
        const hang = [0.3 - hindDown * 0.2, hindDown * 0.2, hindDown * 1.2][i];
        seg.rotation.x = hang + (i === 0 ? Math.sin(a.cycle * Math.PI * 2) * 0.05 * w : 0);
      });
    } else {
      const wag = (a.pace > 0.5 ? 0.3 : 0) + sw.amp + (a.lie > 0.5 ? -0.2 : 0);
      a.tail[0].rotation.z = Math.sin(sw.t * 11) * Math.max(0, wag);
      a.tail[0].rotation.x = -2.2 + a.lie * 1.2;
    }
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
        animate(a, dt, focus);
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
