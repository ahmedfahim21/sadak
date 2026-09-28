/**
 * Bengaluru / Majestic kit.
 *
 * Signature reads: a glass-and-steel tech park slab with a real mullion
 * grid (not a flat-coloured box), bamboo/steel scaffolding wrapped in green
 * safety mesh, an elevated metro pillar carrying a girder span, and a
 * food-delivery bike dominated by its insulated box.
 */

import * as THREE from "three";
import {
  bakedBox,
  bakedCyl,
  mergeByMaterial,
  mulberry32,
  stdMat,
  type AssetMaterialLib,
  type Part,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Hero: tech park slab — concrete core, curtain-wall glass grid, mullions,
 * entrance canopy, rooftop plant. ~18m tall.
 * ------------------------------------------------------------------ */
export function makeTechParkSlab(mats?: AssetMaterialLib, seed = 20): THREE.Group {
  const rand = mulberry32(seed);
  const core = stdMat(0x8c9096, { roughness: 0.75, metalness: 0.1 }, mats);
  const glass = stdMat(0x8fb8c9, {
    roughness: 0.15,
    metalness: 0.6,
    transparent: true,
    opacity: 0.72,
  }, mats);
  const mullion = stdMat(0x33383e, { roughness: 0.4, metalness: 0.7 }, mats);
  const accent = stdMat(0x2e86c1, { roughness: 0.3, metalness: 0.5 }, mats);

  const coreParts: Part[] = [];
  const glassParts: Part[] = [];
  const mullionParts: Part[] = [];
  const accentParts: Part[] = [];

  const w = 7.5;
  const d = 5.5;
  const floors = 6;
  const floorH = 2.6;
  const h = floors * floorH;

  coreParts.push({ geo: bakedBox(w, 0.6, d, 0, 0.3, 0), mat: core }); // plinth
  coreParts.push({ geo: bakedBox(1.4, h, d + 0.2, -w / 2 + 0.7, h / 2 + 0.6, 0), mat: core }); // service core spine

  // Curtain-wall grid on the two long faces: a mullion frame per cell plus a
  // glass pane set slightly behind it, floor by floor, bay by bay.
  const bays = 5;
  for (const facing of [1, -1] as const) {
    for (let f = 0; f < floors; f++) {
      const cy = 0.6 + f * floorH + floorH / 2;
      for (let b = 0; b < bays; b++) {
        const spanW = (w - 1.4) / bays;
        const cx = -w / 2 + 1.4 + spanW * (b + 0.5);
        const cz = (facing * d) / 2;
        glassParts.push({ geo: bakedBox(spanW - 0.14, floorH - 0.16, 0.05, cx, cy, cz - facing * 0.08), mat: glass });
        mullionParts.push({ geo: bakedBox(0.08, floorH - 0.1, 0.1, cx - spanW / 2, cy, cz - facing * 0.06), mat: mullion });
        mullionParts.push({ geo: bakedBox(spanW, 0.08, 0.1, cx, cy - floorH / 2, cz - facing * 0.06), mat: mullion });
      }
    }
  }
  // Parapet cap ledge across the top of each face.
  for (const facing of [1, -1] as const) {
    coreParts.push({
      geo: bakedBox(w + 0.15, 0.4, 0.2, 0, 0.6 + h + 0.2, (facing * d) / 2),
      mat: core,
    });
  }
  coreParts.push({ geo: bakedBox(w + 0.3, 0.3, d + 0.3, 0, 0.6 + h + 0.45, 0), mat: core }); // roof slab

  // Ground floor entrance canopy + a couple of accent mullion fins.
  accentParts.push({ geo: bakedBox(3.2, 0.15, 1.6, 0, 2.9, d / 2 + 0.8), mat: accent });
  for (const x of [-1.5, 1.5]) {
    coreParts.push({ geo: bakedCyl(0.08, 0.08, 2.9, 8, x, 1.45, d / 2 + 1.5), mat: mullion });
  }
  for (let i = 0; i < 3; i++) {
    accentParts.push({ geo: bakedBox(0.15, h * 0.5, 0.06, -w / 2 + 1.9 + i * (w - 2.0) / 2, h * 0.5, d / 2 + 0.02), mat: accent });
  }

  // Rooftop plant: chiller units + a lift overrun box.
  coreParts.push({ geo: bakedBox(2.4, 1.6, 2.4, 1.6, 0.6 + h + 1.4, -1.2), mat: core });
  for (const [x, z] of [
    [-1.8, 1.2],
    [-0.6, 1.2],
  ]) {
    coreParts.push({ geo: bakedBox(1.0, 0.6, 1.0, x, 0.6 + h + 0.9, z), mat: mullion });
  }

  void rand;
  const g = new THREE.Group();
  g.add(
    mergeByMaterial(coreParts),
    mergeByMaterial(glassParts),
    mergeByMaterial(mullionParts),
    mergeByMaterial(accentParts)
  );
  g.name = "bengaluru-tech-park";
  return g;
}

/* ------------------------------------------------------------------ *
 * Street prop: bamboo/steel scaffolding wrapped in green safety mesh.
 * ~8m tall.
 * ------------------------------------------------------------------ */
export function makeScaffolding(mats?: AssetMaterialLib, seed = 21): THREE.Group {
  const rand = mulberry32(seed);
  const pole = stdMat(0x9c8a5c, { roughness: 0.85 }, mats);
  const clamp = stdMat(0x3a3d40, { roughness: 0.55, metalness: 0.5 }, mats);
  const mesh = stdMat(0x2fa84f, {
    roughness: 0.85,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
  }, mats);

  const poleParts: Part[] = [];
  const clampParts: Part[] = [];
  const meshParts: Part[] = [];

  const bays = 3;
  const bayW = 1.6;
  const h = 7.5;
  const d = 1.1;

  // Vertical standards, front and back rows.
  for (let b = 0; b <= bays; b++) {
    const x = -((bays * bayW) / 2) + b * bayW;
    for (const z of [0, d]) {
      poleParts.push({ geo: bakedCyl(0.045, 0.045, h, 6, x, h / 2, z), mat: pole });
    }
  }
  // Horizontal ledgers every ~1.6m.
  const lifts = 5;
  for (let l = 1; l <= lifts; l++) {
    const y = (h / lifts) * l - 0.2;
    for (const z of [0, d]) {
      poleParts.push({ geo: bakedBox(bays * bayW + 0.1, 0.05, 0.05, 0, y, z, 0, 0, Math.PI / 2), mat: pole });
    }
    for (let b = 0; b <= bays; b++) {
      const x = -((bays * bayW) / 2) + b * bayW;
      poleParts.push({ geo: bakedBox(0.05, 0.05, d, x, y, d / 2, 0, Math.PI / 2, 0), mat: pole });
    }
    // clamps at the joints
    for (let b = 0; b <= bays; b++) {
      const x = -((bays * bayW) / 2) + b * bayW;
      clampParts.push({ geo: bakedBox(0.14, 0.1, 0.14, x, y, 0), mat: clamp });
    }
  }
  // Diagonal cross-braces for the classic scaffolding X pattern.
  for (let b = 0; b < bays; b++) {
    const x0 = -((bays * bayW) / 2) + b * bayW;
    poleParts.push({ geo: bakedBox(bayW * 1.02, 0.04, 0.04, x0 + bayW / 2, h * 0.35, 0, 0, 0, 0.5), mat: pole });
    poleParts.push({ geo: bakedBox(bayW * 1.02, 0.04, 0.04, x0 + bayW / 2, h * 0.72, 0, 0, 0, -0.5), mat: pole });
  }

  // The green debris/safety mesh sheeting draped across the whole face —
  // the single detail that makes this read as "under construction" rather
  // than generic scaffolding.
  meshParts.push({ geo: bakedBox(bays * bayW + 0.2, h - 0.4, 0.03, 0, h / 2, d + 0.08), mat: mesh });
  meshParts.push({ geo: bakedBox(0.03, h - 0.4, d + 0.2, -((bays * bayW) / 2) - 0.1, h / 2, d / 2), mat: mesh });

  // Wooden planked platform partway up.
  poleParts.push({ geo: bakedBox(bays * bayW, 0.08, d, 0, h * 0.42, d / 2), mat: pole });

  void rand;
  const g = new THREE.Group();
  g.add(mergeByMaterial(poleParts), mergeByMaterial(clampParts), mergeByMaterial(meshParts));
  g.name = "bengaluru-scaffolding";
  return g;
}

/* ------------------------------------------------------------------ *
 * Hero: elevated metro pillar with a girder span. ~14m tall including the
 * deck, so it reads as infrastructure cutting across the street.
 * ------------------------------------------------------------------ */
export function makeMetroPillar(mats?: AssetMaterialLib, seed = 22): THREE.Group {
  const rand = mulberry32(seed);
  const concrete = stdMat(0xb7b2a6, { roughness: 0.82 }, mats);
  const steel = stdMat(0x4a5560, { roughness: 0.4, metalness: 0.7 }, mats);
  const line = stdMat(0x1f6feb, { roughness: 0.5, metalness: 0.3 }, mats);

  const concreteParts: Part[] = [];
  const steelParts: Part[] = [];
  const lineParts: Part[] = [];

  const pierH = 9.5;
  // Tapered pier, wider at base.
  concreteParts.push({ geo: bakedCyl(0.55, 0.75, pierH, 10, 0, pierH / 2, 0), mat: concrete });
  // Y-shaped capital where the pier meets the deck.
  concreteParts.push({ geo: bakedBox(3.6, 0.9, 1.4, 0, pierH + 0.45, 0), mat: concrete });
  for (const x of [-1.3, 1.3]) {
    concreteParts.push({
      geo: bakedBox(0.55, 1.3, 1.0, x, pierH - 0.3, 0, 0, 0, x > 0 ? -0.32 : 0.32),
      mat: concrete,
    });
  }

  // Deck / girder span running perpendicular to the street, plus parapet.
  concreteParts.push({ geo: bakedBox(11, 0.7, 3.2, 0, pierH + 1.1, 0), mat: concrete });
  concreteParts.push({ geo: bakedBox(11.1, 0.35, 0.25, 0, pierH + 1.55, 1.55), mat: concrete });
  concreteParts.push({ geo: bakedBox(11.1, 0.35, 0.25, 0, pierH + 1.55, -1.55), mat: concrete });

  // Steel girder trusswork visible under the deck edge, plus the OHE mast
  // arm and a taut power line for the "elevated metro" read.
  for (let i = -4; i <= 4; i++) {
    steelParts.push({ geo: bakedBox(0.12, 0.5, 3.1, i * 1.2, pierH + 0.65, 0), mat: steel });
  }
  steelParts.push({ geo: bakedCyl(0.07, 0.07, 4.2, 6, -4.8, pierH + 3.2, 1.4), mat: steel });
  steelParts.push({ geo: bakedBox(1.6, 0.06, 0.06, -4.2, pierH + 5.1, 1.4), mat: steel });
  lineParts.push({ geo: bakedBox(9.4, 0.03, 0.03, -0.2, pierH + 4.9, 1.4), mat: line });

  // Standard concrete platform-edge lighting mast on the deck.
  steelParts.push({ geo: bakedCyl(0.05, 0.05, 2.2, 6, 4.0, pierH + 2.3, 1.2), mat: steel });
  steelParts.push({ geo: bakedBox(0.8, 0.08, 0.08, 4.0, pierH + 3.4, 1.2), mat: steel });

  void rand;
  const g = new THREE.Group();
  g.add(mergeByMaterial(concreteParts), mergeByMaterial(steelParts), mergeByMaterial(lineParts));
  g.name = "bengaluru-metro-pillar";
  return g;
}

/* ------------------------------------------------------------------ *
 * Vehicle: food-delivery bike with a big insulated box dominating the rear.
 * ------------------------------------------------------------------ */
export function makeDeliveryBike(mats?: AssetMaterialLib, seed = 23): THREE.Group {
  const rand = mulberry32(seed);
  const bodyCol = [0xe74c3c, 0x2c3e50, 0xf39c12][Math.floor(rand() * 3)];
  const body = stdMat(bodyCol, { roughness: 0.55, metalness: 0.35 }, mats);
  const black = stdMat(0x161616, { roughness: 0.6 }, mats);
  const chrome = stdMat(0xcfd4d8, { roughness: 0.3, metalness: 0.85 }, mats);
  const boxMat = stdMat([0xe74c3c, 0x27ae60, 0xf1c40f][Math.floor(rand() * 3)], { roughness: 0.7 }, mats);

  const bodyParts: Part[] = [];
  const wheelParts: Part[] = [];
  const boxParts: Part[] = [];

  // Frame + fuel tank + seat.
  bodyParts.push({ geo: bakedBox(0.16, 0.22, 1.3, 0, 0.62, 0.05), mat: body });
  bodyParts.push({ geo: bakedBox(0.34, 0.28, 0.5, 0, 0.75, 0.35), mat: body }); // tank
  bodyParts.push({ geo: bakedBox(0.3, 0.14, 0.7, 0, 0.72, -0.35), mat: black }); // seat
  bodyParts.push({ geo: bakedCyl(0.03, 0.03, 0.6, 6, 0, 0.85, 0.85, Math.PI * 0.42), mat: chrome }); // front fork
  bodyParts.push({ geo: bakedBox(0.5, 0.04, 0.04, 0, 1.05, 1.05), mat: chrome }); // handlebar
  bodyParts.push({ geo: bakedBox(0.28, 0.32, 0.18, 0, 0.55, 1.15), mat: black }); // headlamp housing
  bodyParts.push({ geo: bakedCyl(0.09, 0.09, 0.16, 10, 0, 0.55, 1.24, Math.PI / 2), mat: chrome }); // headlamp

  // Wheels.
  for (const z of [0.95, -0.85]) {
    wheelParts.push({ geo: bakedCyl(0.32, 0.32, 0.14, 14, 0, 0.32, z, 0, Math.PI / 2), mat: black });
    bodyParts.push({ geo: bakedBox(0.1, 0.16, 0.5, 0, 0.5, z), mat: black }); // mudguard-ish
  }
  bodyParts.push({ geo: bakedCyl(0.04, 0.04, 1.0, 6, 0, 0.32, 0.05, 0, Math.PI / 2), mat: black }); // swingarm suggestion

  // The big insulated delivery box dominating the rear rack — the whole
  // point of this vehicle.
  boxParts.push({ geo: bakedBox(0.62, 0.62, 0.55, 0, 1.05, -0.95), mat: boxMat });
  boxParts.push({ geo: bakedBox(0.66, 0.06, 0.6, 0, 1.37, -0.95), mat: black }); // lid lip
  bodyParts.push({ geo: bakedBox(0.5, 0.05, 0.5, 0, 0.72, -0.95), mat: black }); // rack under the box

  void rand;
  const g = new THREE.Group();
  g.add(mergeByMaterial(bodyParts), mergeByMaterial(wheelParts), mergeByMaterial(boxParts));
  g.name = "bengaluru-delivery-bike";
  return g;
}

/* ------------------------------------------------------------------ *
 * Majestic's single-screen cinemas (Santosh, Sapna, Anupama, Triveni on
 * Kempegowda Road): not Bombay Art Deco but 1970s concrete halls. A tall
 * blank auditorium behind; in front a lobby block with a glazed, grilled
 * ground floor and a ribbon of windows behind concrete fins; a name pylon
 * standing proud at one corner, lit in bands; a thin cantilevered canopy
 * over the forecourt on two columns; a ticket booth with its windows to
 * one side; black water tanks on the roof. Front at +z. The film hoarding
 * goes on the lobby roof (world/index.ts). ~22m wide, ~17m to the pylon.
 * ------------------------------------------------------------------ */

/** The hall's parts that stand on the ground, for its colliders (model frame). */
export function singleScreenCinemaSolids(seed: number): [number, number, number, number][] {
  const { side } = singleScreenLayout(seed);
  const px = side * 9.4;
  const bx = -side * 8.2;
  return [
    [-11, -14, 11, 2], // auditorium
    [-11, 2, 11, 7], // lobby
    [px - 1.2, 6.9, px + 1.2, 8.0], // pylon
    [bx - 1.5, 8.2, bx + 1.5, 10.2], // ticket booth
    ...[-1, 1].map((k): [number, number, number, number] => [side * -1 + k * 5.4 - 0.18, 10.42, side * -1 + k * 5.4 + 0.18, 10.78]), // canopy columns
  ];
}

function singleScreenLayout(seed: number) {
  const rand = mulberry32(seed);
  const palettes = [
    { wall: 0xefe4cc, band: 0x8e2b2b, fin: 0xf2c14e, pylon: 0xc0392b },
    { wall: 0xf0cfc8, band: 0x1f6f6a, fin: 0xf6f1e7, pylon: 0x1f6f6a },
    { wall: 0xcfe3cf, band: 0xb03a2e, fin: 0xf6f1e7, pylon: 0xe0a526 },
    { wall: 0xc9dcec, band: 0x24406e, fin: 0xf6f1e7, pylon: 0xe06c2a },
  ];
  return { rand, palette: palettes[seed % palettes.length], side: seed % 2 ? 1 : -1 };
}

/** `seed` 0, 1, 2, ...: each of a district's cinemas in its own colours, the pylon on alternate corners. */
export function makeSingleScreenCinema(mats?: AssetMaterialLib, seed = 0): THREE.Group {
  const { rand, palette, side } = singleScreenLayout(seed);
  const wall = stdMat(palette.wall, { roughness: 0.9 }, mats);
  const band = stdMat(palette.band, { roughness: 0.8 }, mats);
  const fin = stdMat(palette.fin, { roughness: 0.85 }, mats);
  const concrete = stdMat(0xb9b4aa, { roughness: 0.95 }, mats);
  const glass = stdMat(0x24343f, { roughness: 0.2, metalness: 0.3 }, mats);
  const grille = stdMat(0x3a3d42, { roughness: 0.6, metalness: 0.5 }, mats);
  const pylon = stdMat(palette.pylon, { roughness: 0.7 }, mats);
  const lit = stdMat(0xfff2c2, { emissive: 0xffd36b, emissiveIntensity: 0.9, roughness: 0.4 }, mats);
  const tank = stdMat(0x1d1f22, { roughness: 0.6 }, mats);
  const P: Part[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => P.push({ geo, mat });

  // Auditorium: a tall blank box, pilasters down its long sides, exit doors
  // under little hoods, a band at the parapet.
  add(bakedBox(22, 12.5, 16, 0, 6.25, -6), wall);
  add(bakedBox(22.3, 0.7, 16.3, 0, 12.2, -6), band);
  for (const sx of [-1, 1]) {
    for (let z = -13; z <= 1; z += 3.5) add(bakedBox(0.4, 12, 0.7, sx * 11.1, 6, z), fin);
    for (const z of [-10, -3]) {
      add(bakedBox(0.1, 2.4, 1.6, sx * 11.05, 1.2, z), grille);
      add(bakedBox(0.9, 0.12, 2.2, sx * 11.4, 2.7, z), concrete);
    }
  }
  // The lobby block in front: glazed ground floor behind a collapsible
  // grille, a ribbon of windows above between concrete fins, a band on top.
  add(bakedBox(22, 8.5, 5, 0, 4.25, 4.5), wall);
  add(bakedBox(22.3, 0.6, 5.3, 0, 8.3, 4.5), band);
  add(bakedBox(15, 3.1, 0.1, -side, 1.65, 7.02), glass);
  for (let x = -7.4; x <= 7.4; x += 0.35) add(bakedBox(0.04, 3.0, 0.05, -side + x, 1.65, 7.1), grille);
  add(bakedBox(19, 2.2, 0.1, 0, 5.8, 7.02), glass);
  for (let x = -9.4; x <= 9.4; x += 0.95) add(bakedBox(0.14, 2.6, 0.8, x, 5.8, 7.25), fin);
  add(bakedBox(19.6, 0.25, 0.9, 0, 4.55, 7.3), fin);
  add(bakedBox(19.6, 0.25, 0.9, 0, 7.05, 7.3), fin);

  // The name pylon: proud of the front at one corner, taller than all of
  // it, lit in stacked bands (where the name's letters run down it).
  const px = side * 9.4;
  add(bakedBox(2.2, 17, 1.0, px, 8.5, 7.45), pylon);
  for (let i = 0; i < 6; i++) add(bakedBox(1.5, 1.4, 0.12, px, 9.6 + i * 1.7, 8.0), lit);
  add(bakedBox(2.6, 0.4, 1.4, px, 17.2, 7.45), band);

  // The canopy over the forecourt: a thin slab cantilevered off the lobby,
  // on two slender columns, lit on its edge.
  const cx = -side * 1;
  add(bakedBox(13, 0.35, 4.2, cx, 4.3, 9.1), concrete);
  add(bakedBox(13, 0.3, 0.12, cx, 4.3, 11.25), lit);
  for (const k of [-1, 1]) add(bakedCyl(0.16, 0.18, 4.2, 10, cx + k * 5.4, 2.1, 10.6), concrete);

  // Ticket booth to one side of the forecourt: three windows with their
  // grilles and a little sloping roof.
  const bx = -side * 8.2;
  add(bakedBox(3, 2.6, 2, bx, 1.3, 9.2), wall);
  for (const k of [-1, 0, 1]) {
    add(bakedBox(0.6, 0.5, 0.06, bx + k * 0.9, 1.4, 10.22), glass);
    add(bakedBox(0.6, 0.06, 0.25, bx + k * 0.9, 1.1, 10.3), concrete);
  }
  add(bakedBox(3.5, 0.18, 2.6, bx, 2.75, 9.35, 0.12), band);

  // On the roof: the projection room over the lobby's back and the water tanks.
  add(bakedBox(6, 2.4, 3, side * 3, 9.7, 2.6), wall);
  for (let i = 0; i < 3; i++) add(bakedCyl(0.65, 0.65, 1.3, 12, -side * (2 + i * 1.7) + (rand() - 0.5) * 0.3, 13.2, -9 + rand() * 2), tank);

  const g = mergeByMaterial(P);
  g.name = "bengaluru-single-screen";
  return g;
}
