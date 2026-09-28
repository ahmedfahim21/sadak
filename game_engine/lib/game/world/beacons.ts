/**
 * Wayfinding in the world itself: the waypoint's pillar of light, seen over
 * the rooftops from anywhere in the district, and gold chevrons on the
 * ground at each monument's entrance, sweeping inward, so the way in is
 * never a guess. Unlit, additive materials: the cel pass leaves them as
 * they are, and they read as markers, not as part of the street.
 */

import * as THREE from "three";
import type { MapData } from "./mapData";

/** How near an entrance its chevrons show, metres. */
export const ENTRANCE_REACH = 70;

const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColour;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // Brightest at the foot, fading up into the sky, with a slow shimmer.
    float a = pow(1.0 - vUv.y, 1.6) * (0.5 + 0.08 * sin(uTime * 3.0 + vUv.y * 20.0));
    gl_FragColor = vec4(uColour, a);
  }
`;

export type Beacon = {
  group: THREE.Group;
  set(x: number, z: number, y: number): void;
  clear(): void;
  update(t: number): void;
  dispose(): void;
};

export function createWaypointBeacon(colour = 0xffffff): Beacon {
  const group = new THREE.Group();
  group.name = "waypoint";
  group.visible = false;
  const uniforms = { uColour: { value: new THREE.Color(colour) }, uTime: { value: 0 } };
  const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 70, 16, 1, true).translate(0, 35, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  group.add(beam);
  const ringGeo = new THREE.RingGeometry(0.9, 1.25, 40).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.06;
  group.add(ring);
  return {
    group,
    set(x, z, y) {
      group.position.set(x, y, z);
      group.visible = true;
    },
    clear() {
      group.visible = false;
    },
    update(t) {
      if (!group.visible) return;
      uniforms.uTime.value = t;
      // The ring breathes outward, so the spot reads from a distance.
      const k = (t * 0.8) % 1;
      ring.scale.setScalar(1 + k * 1.6);
      ringMat.opacity = 0.8 * (1 - k);
    },
    dispose() {
      beamGeo.dispose();
      beamMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}

/** A chevron on the ground, pointing along +z. */
function chevronGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.9, -0.25);
  s.lineTo(0, 0.45);
  s.lineTo(0.9, -0.25);
  s.lineTo(0.9, -0.65);
  s.lineTo(0, 0.05);
  s.lineTo(-0.9, -0.65);
  s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI);
}

export type Entrances = {
  group: THREE.Group;
  update(t: number, player: THREE.Vector3): void;
  dispose(): void;
};

export function createEntrances(map: MapData, groundAt: (x: number, z: number) => number, colour = 0xf5c518): Entrances {
  const group = new THREE.Group();
  group.name = "entrances";
  const geo = chevronGeometry().scale(1.5, 1, 1.5);
  // A dark outline under each chevron: gold alone vanishes on pale sand
  // and marble.
  const outlineGeo = chevronGeometry().scale(1.5 * 1.25, 1, 1.5 * 1.35);
  const doors: { g: THREE.Group; mats: THREE.MeshBasicMaterial[]; outlines: THREE.MeshBasicMaterial[]; x: number; z: number }[] = [];
  for (const l of map.landmarks) {
    if (!l.door) continue;
    const [x, z] = l.door;
    const g = new THREE.Group();
    g.position.set(x, groundAt(x, z) + 0.06, z);
    // The door is on the landmark's local +z: point the chevrons back in.
    g.rotation.y = l.rot + Math.PI;
    const mats: THREE.MeshBasicMaterial[] = [];
    const outlines: THREE.MeshBasicMaterial[] = [];
    for (let k = 0; k < 3; k++) {
      const om = new THREE.MeshBasicMaterial({ color: 0x1a1206, transparent: true, opacity: 0, depthWrite: false });
      const o = new THREE.Mesh(outlineGeo, om);
      const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      // Outermost first, walking in, all on the ground before the door
      // (the door is the foot of the stair; on it they'd be under the steps).
      o.position.z = m.position.z = -6.2 + k * 1.7;
      m.position.y = 0.01;
      o.renderOrder = 1;
      m.renderOrder = 2;
      g.add(o, m);
      mats.push(mat);
      outlines.push(om);
    }
    g.visible = false;
    group.add(g);
    doors.push({ g, mats, outlines, x, z });
  }
  return {
    group,
    update(t, player) {
      for (const d of doors) {
        const dist = Math.hypot(d.x - player.x, d.z - player.z);
        // Shown on the approach; gone once you're at the door.
        d.g.visible = dist < ENTRANCE_REACH && dist > 3;
        if (!d.g.visible) continue;
        const fade = Math.min(1, (ENTRANCE_REACH - dist) / 15);
        d.mats.forEach((m, k) => {
          // A sweep from the outer chevron to the inner, round and round.
          const phase = (t * 1.2 - k * 0.28) % 1;
          m.opacity = fade * (0.45 + 0.55 * Math.max(0, 1 - Math.abs(phase - 0.2) * 3));
          d.outlines[k].opacity = fade * 0.5;
        });
      }
    },
    dispose() {
      geo.dispose();
      outlineGeo.dispose();
      for (const d of doors) [...d.mats, ...d.outlines].forEach((m) => m.dispose());
    },
  };
}
