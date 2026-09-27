import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeAmbassadorTaxi, makeHandRickshaw } from "./kolkata";
import { makeCycleRickshaw } from "./delhi";
import { autoBodyFor, makeAuto } from "../props";

const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());

test("the Ambassador is a car's shape: long the way it points, not wider than it is long", () => {
  const s = size(makeAmbassadorTaxi());
  assert.ok(s.z > 3.5 && s.z < 4.4, `length ${s.z.toFixed(2)}m`);
  assert.ok(s.x > 1.6 && s.x < 2.0, `width ${s.x.toFixed(2)}m`);
  assert.ok(s.y > 1.4 && s.y < 1.8, `height ${s.y.toFixed(2)}m`);
});

test("rickshaw wheels stand upright on axles across the vehicle", () => {
  for (const [name, g, r] of [
    ["cycle rickshaw", makeCycleRickshaw(), 0.42],
    ["hand rickshaw", makeHandRickshaw(), 0.5],
  ] as const) {
    // The tyres: the darkest mesh. Upright wheels are as tall as they are
    // across; flat ones would be a few centimetres tall.
    let tyres: THREE.Mesh | null = null;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const c = (m.material as THREE.MeshStandardMaterial).color;
      if (c && c.r + c.g + c.b < 0.15 && (!tyres || size(m).y > size(tyres).y)) tyres = m;
    });
    assert.ok(tyres, `${name}: no tyres`);
    const s = size(tyres!);
    assert.ok(s.y > r * 1.8, `${name}: wheels ${s.y.toFixed(2)}m tall, lying flat`);
  }
});

test("an auto: three wheels, auto-sized, the body in its city's colour", () => {
  const a = makeAuto(0xf5c518, autoBodyFor("delhi"));
  const s = size(a);
  assert.ok(s.z > 2.4 && s.z < 3.0, `length ${s.z.toFixed(2)}m`);
  assert.ok(s.x > 1.3 && s.x < 1.8, `width ${s.x.toFixed(2)}m`);
  assert.ok(s.y > 1.8 && s.y < 2.2, `height ${s.y.toFixed(2)}m`);
  assert.equal((a.userData.wheels as THREE.Object3D[]).length, 3);
  assert.notEqual(autoBodyFor("delhi"), autoBodyFor("mumbai"), "Delhi's CNG green, Mumbai's black");
});

test("every vehicle in traffic has a driver, seated inside it (a hand rickshaw's puller at the shafts)", async () => {
  const { makeCycleRickshaw } = await import("./delhi");
  const { makeAmbassadorTaxi, makeHandRickshaw } = await import("./kolkata");
  const { makeAuto } = await import("../props");
  const { makeCar, createVehicleMaterials, TRAFFIC_KINDS } = await import("../vehicles");
  const { seatDriver } = await import("../transit");
  const mats = createVehicleMaterials();
  const vehicles: [string, THREE.Group][] = [
    ["auto", makeAuto()],
    ["cycle rickshaw", makeCycleRickshaw(undefined, 3)],
    ["hand rickshaw", makeHandRickshaw(undefined, 3)],
    ["ambassador", makeAmbassadorTaxi(undefined, 3)],
    ...TRAFFIC_KINDS.map((k) => [k, makeCar(mats, { kind: k, seed: 5 })] as [string, THREE.Group]),
  ];
  for (const [name, v] of vehicles) {
    const body = new THREE.Box3().setFromObject(v);
    const d = seatDriver(v, 7);
    const man = new THREE.Box3().setFromObject(d);
    assert.equal(v.userData.driver, d, name);
    // Within the vehicle's footprint, and (under a roof) below it.
    assert.ok(man.min.x >= body.min.x - 0.05 && man.max.x <= body.max.x + 0.05, `${name}: driver sticks out sideways`);
    assert.ok(man.min.z >= body.min.z - 0.05 && man.max.z <= body.max.z + 0.3, `${name}: driver sticks out ahead or behind`);
    if (name !== "cycle rickshaw" && name !== "hand rickshaw") assert.ok(man.max.y <= body.max.y, `${name}: head through the roof (${man.max.y.toFixed(2)} > ${body.max.y.toFixed(2)})`);
    assert.ok(man.max.y > 1, `${name}: driver too low to be seen`);
  }
});
