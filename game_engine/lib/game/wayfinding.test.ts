import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MapData } from "./world/mapData";
import { planWalk } from "./world/route";
import { pinToEdge } from "../../components/map/blips";
import { entrances } from "../../components/map/mapKit";

const loadMap = (id: string) => JSON.parse(readFileSync(join(__dirname, "../../public/maps", `${id}.json`), "utf8")) as MapData;

test("a marker inside the minimap stays put; one beyond it is pinned to the rim, pointing its way", () => {
  assert.deepEqual(pinToEdge(10, -20, 50), { x: 10, y: -20, pinned: false, angle: Math.atan2(-20, 10) });
  const far = pinToEdge(300, 100, 50);
  assert.equal(far.pinned, true);
  assert.equal(Math.max(Math.abs(far.x), Math.abs(far.y)), 50);
  // Same direction from the centre, just nearer.
  assert.ok(Math.abs(Math.atan2(far.y, far.x) - Math.atan2(100, 300)) < 1e-9);
  const behind = pinToEdge(-5, 900, 50);
  assert.deepEqual([behind.x.toFixed(3), behind.y], [(-5 * 50 / 900).toFixed(3), 50]);
});

test("the waypoint's walk follows the streets from the player to the spot", () => {
  const map = loadMap("purani-sadak");
  const from: [number, number] = [map.spawn.x, map.spawn.z];
  const to: [number, number] = [-281, -318];
  const walk = planWalk(map, from[0], from[1], to[0], to[1]);
  assert.ok(walk && walk.length > 2, "no walk");
  const d = (a: [number, number], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  assert.ok(d(from, walk[0]) < 25, `starts ${d(from, walk[0]).toFixed(0)}m from the player`);
  assert.ok(d(to, walk.at(-1)!) < 25, `ends ${d(to, walk.at(-1)!).toFixed(0)}m from the spot`);
  let len = 0;
  for (let i = 1; i < walk.length; i++) len += d(walk[i - 1] as [number, number], walk[i]);
  // Along streets: longer than the crow flies, but not a detour round the district.
  assert.ok(len >= d(from, to) && len < d(from, to) * 2.2, `${len.toFixed(0)}m for ${d(from, to).toFixed(0)}m`);
});

test("every monument you walk into has its entrance marked, in every city", () => {
  for (const f of readdirSync(join(__dirname, "../../public/maps")).filter((x) => x.endsWith(".json"))) {
    const map = loadMap(f.replace(".json", ""));
    const doors = entrances(map);
    assert.equal(doors.length, map.landmarks.filter((l) => l.door).length, f);
    assert.ok(doors.length >= 1, `${f}: no entrances to mark`);
  }
});
