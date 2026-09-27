import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { azaanDue, PRAYERS, soundSites } from "./ambience";
import type { MapData } from "@/lib/game/world/mapData";

const MAPS = join(__dirname, "../../public/maps");
const maps = readdirSync(MAPS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(MAPS, f), "utf8")) as MapData);

/** A UTC Date for a time of day in India. */
const ist = (h: number, m: number) => new Date(Date.UTC(2026, 8, 27, h, m) - 5.5 * 3600e3);

test("the azaan is due only in the minutes after each prayer's time, by India's clock", () => {
  assert.equal(azaanDue(ist(12, 30)), "dhuhr");
  assert.equal(azaanDue(ist(12, 39)), "dhuhr");
  assert.equal(azaanDue(ist(12, 41)), null);
  assert.equal(azaanDue(ist(12, 29)), null);
  assert.equal(azaanDue(ist(5, 7)), "fajr");
  assert.equal(azaanDue(ist(18, 24)), "maghrib");
  assert.equal(azaanDue(ist(3, 0)), null);
  // Five a day, and nothing due for most of it: never a loop.
  let due = 0;
  for (let m = 0; m < 24 * 60; m++) if (azaanDue(ist(0, m))) due++;
  assert.equal(due, PRAYERS.length * 10);
});

test("every district has somewhere that sounds like worship, of the faiths it maps", () => {
  for (const map of maps) {
    const sites = soundSites(map);
    for (const s of sites) assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), `${map.id}: site at a real place`);
    // No two of the same kind on top of each other (a landmark and its own POI).
    for (const a of sites)
      for (const b of sites)
        if (a !== b && a.kind === b.kind && !a.big && !b.big) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1, `${map.id}: duplicate ${a.kind}`);
    const worship = map.pois.filter((p) => p.kind === "worship" && ["hindu", "sikh", "muslim"].includes(p.religion ?? ""));
    if (worship.length) assert.ok(sites.length > 0, `${map.id}: mapped worship but no sound`);
  }
  const all = maps.flatMap((m) => soundSites(m).map((s) => s.kind));
  for (const kind of ["temple", "gurdwara", "mosque"]) assert.ok(all.includes(kind as never), `some district has a ${kind}`);
});

test("a gurdwara's landmark is heard as a gurdwara, a masjid as a mosque", () => {
  const base = maps[0];
  const map = {
    ...base,
    pois: [],
    landmarks: [
      { ...base.landmarks[0], model: "harmandir_sahib", x: 0, z: 0 },
      { ...base.landmarks[0], model: "mosque_small", x: 100, z: 0 },
      { ...base.landmarks[0], model: "gopuram_temple", x: 200, z: 0 },
      { ...base.landmarks[0], model: "statue", x: 300, z: 0 },
    ],
  } as MapData;
  assert.deepEqual(
    soundSites(map).map((s) => [s.kind, s.x, s.big]),
    [
      ["gurdwara", 0, true],
      ["mosque", 100, false],
      ["temple", 200, true],
    ]
  );
});
