/**
 * The street's sound, synthesised and placed round the listener:
 *
 *  - traffic: an engine rumble that swells with the vehicles near you, and
 *    horns from the vehicles themselves (a car's two-tone blare, an auto's
 *    pip-pip, a bus's low bray, a scooter's beep), far more often from one
 *    held up by someone in the road;
 *  - the crowd: a murmur that rises with how many people are about;
 *  - temples: bells rung now and then, and a soft chant in the city's raga
 *    when you're close; gurdwaras: kirtan over a harmonium;
 *  - mosques: the azaan, heard once from a distance at the prayer times of
 *    the real clock (India's), just the opening takbir, never looped.
 *
 * Everything plays through the SFX bus, so the SFX mute silences it, and it
 * ducks under dialogue with the music.
 */

import { getAudioContext, sfxOutput } from "./engine";
import { DISTRICT_MUSIC, type Composition } from "./music/cities";
import { held, impulse, type Voice } from "./music/instruments";
import { midiToHz, swaraHz, type Swara } from "./music/theory";
import type { MapData } from "@/lib/game/world/mapData";

export type SoundVehicle = { mesh: { position: { x: number; z: number } }; kind: string; speed: number; heldUp?: boolean };
/** What the listener hears from, pushed by the game ten times a second. */
export type SoundFrame = { x: number; z: number; heading: number; vehicles: SoundVehicle[]; crowd: number };

type SiteKind = "temple" | "gurdwara" | "mosque";
export type Site = { kind: SiteKind; x: number; z: number; big: boolean };

const TEMPLE_MODELS = new Set(["temple", "gopuram_temple", "deul_small", "lingaraj", "shrine", "kalinga_deul"]);
const GURDWARA_MODELS = new Set(["gurdwara_small", "akal_takht", "harmandir_sahib"]);
const MOSQUE_MODELS = new Set(["jama_masjid", "mosque_small"]);

/** Places of worship that sound: modelled landmarks, and mapped points by religion. */
export function soundSites(map: MapData): Site[] {
  const out: Site[] = [];
  for (const l of map.landmarks) {
    const kind: SiteKind | null = TEMPLE_MODELS.has(l.model) ? "temple" : GURDWARA_MODELS.has(l.model) ? "gurdwara" : MOSQUE_MODELS.has(l.model) ? "mosque" : null;
    if (kind) out.push({ kind, x: l.x, z: l.z, big: l.model === "jama_masjid" || l.model === "harmandir_sahib" || l.model === "lingaraj" || l.model === "gopuram_temple" });
  }
  for (const p of map.pois) {
    if (p.kind !== "worship") continue;
    const kind: SiteKind | null = p.religion === "hindu" ? "temple" : p.religion === "sikh" ? "gurdwara" : p.religion === "muslim" ? "mosque" : null;
    if (kind && !out.some((s) => s.kind === kind && Math.hypot(s.x - p.x, s.z - p.z) < 30)) out.push({ kind, x: p.x, z: p.z, big: false });
  }
  return out;
}

/** The five prayers, as minutes after midnight in India (a year-round average). */
export const PRAYERS: [string, number][] = [
  ["fajr", 5 * 60 + 6],
  ["dhuhr", 12 * 60 + 30],
  ["asr", 16 * 60 + 36],
  ["maghrib", 18 * 60 + 24],
  ["isha", 19 * 60 + 48],
];
/** Minutes after a prayer's time that its azaan may still be heard (arriving late). */
const AZAAN_WINDOW = 10;

/** Which prayer's azaan is due at `when`, if any (by India's clock). */
export function azaanDue(when: Date): string | null {
  const ist = (when.getUTCHours() * 60 + when.getUTCMinutes() + 330) % 1440;
  for (const [name, m] of PRAYERS) {
    const after = ist - m;
    if (after >= 0 && after < AZAAN_WINDOW) return name;
  }
  return null;
}

const rand = Math.random;

class Ambience {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private duck: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private trafficGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private beds: AudioScheduledSourceNode[] = [];
  private sites: Site[] = [];
  private music: Composition | null = null;
  private district: string | null = null;
  private lastHonk = new WeakMap<object, number>();
  private nextBell = new Map<Site, number>();
  private chant: { voice: Voice; gain: GainNode; site: Site; next: number; step: number } | null = null;
  private heard = new Set<string>();
  private last: SoundFrame | null = null;
  private ducked = false;

  /** Begin a district's sound (the same one again is a no-op). */
  start(map: MapData, districtId: string) {
    if (this.district === districtId) return;
    this.stop();
    const ctx = getAudioContext();
    this.ctx = ctx;
    this.district = districtId;
    this.music = DISTRICT_MUSIC[districtId] ?? null;
    this.sites = soundSites(map);
    this.duck = ctx.createGain();
    this.duck.gain.value = this.ducked ? 0.15 : 1;
    this.duck.connect(sfxOutput());
    this.out = ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(this.duck);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, "hall");
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    this.reverb.connect(wet);
    wet.connect(this.out);

    // The rumble: low noise, the sum of engines and tyres.
    this.trafficGain = ctx.createGain();
    this.trafficGain.gain.value = 0;
    this.trafficGain.connect(this.out);
    const rumble = this.noise();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const hum = ctx.createBiquadFilter();
    hum.type = "peaking";
    hum.frequency.value = 95;
    hum.gain.value = 9;
    rumble.connect(lp);
    lp.connect(hum);
    hum.connect(this.trafficGain);

    // The murmur: voices' formant bands over noise, each breathing on its own.
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    this.crowdGain.connect(this.out);
    for (const [hz, q, g, rate] of [[480, 3, 0.9, 0.7], [1150, 4, 0.55, 1.1], [2500, 5, 0.25, 1.6]]) {
      const src = this.noise();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz;
      bp.Q.value = q;
      const amp = ctx.createGain();
      amp.gain.value = g * 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = g * 0.35;
      lfo.connect(depth);
      depth.connect(amp.gain);
      src.connect(bp);
      bp.connect(amp);
      amp.connect(this.crowdGain);
      lfo.start();
      this.beds.push(lfo);
    }
  }

  stop() {
    if (!this.ctx || !this.duck) return;
    const t = this.ctx.currentTime;
    this.duck.gain.setTargetAtTime(0, t, 0.3);
    const beds = this.beds;
    const duck = this.duck;
    const chant = this.chant;
    chant?.voice.dispose(t);
    setTimeout(() => {
      beds.forEach((b) => b.stop());
      duck.disconnect();
    }, 1500);
    this.beds = [];
    this.chant = null;
    this.district = null;
    this.ctx = null;
  }

  setDucked(ducked: boolean) {
    this.ducked = ducked;
    if (!this.ctx || !this.duck) return;
    this.duck.gain.setTargetAtTime(ducked ? 0.15 : 1, this.ctx.currentTime, ducked ? 0.3 : 1.2);
  }

  /** Where the listener is and what's round them; called about ten times a second. */
  update(f: SoundFrame, dt: number) {
    const ctx = this.ctx;
    if (!ctx || !this.trafficGain || !this.crowdGain) return;
    this.last = f;
    const t = ctx.currentTime;

    // Traffic: the rumble swells with nearby, moving vehicles.
    let rumble = 0;
    for (const v of f.vehicles) {
      const d = Math.hypot(v.mesh.position.x - f.x, v.mesh.position.z - f.z);
      if (d > 70) continue;
      rumble += Math.exp(-d / 22) * (0.4 + Math.min(1, v.speed / 8) * 0.6) * (v.kind === "bus" ? 1.8 : v.kind === "bike" ? 0.5 : 1);
      // Horns: now and then, and insistently when held up.
      const rate = v.heldUp ? 0.7 : v.kind === "auto" || v.kind === "bike" ? 0.05 : 0.025;
      const lastAt = this.lastHonk.get(v) ?? -99;
      if (t - lastAt > (v.heldUp ? 1.2 : 4) && rand() < rate * dt) {
        this.lastHonk.set(v, t);
        this.honk(v.kind, v.mesh.position.x, v.mesh.position.z, d);
      }
    }
    this.trafficGain.gain.setTargetAtTime(Math.min(0.6, rumble * 0.12), t, 0.4);
    this.crowdGain.gain.setTargetAtTime(Math.min(0.5, (f.crowd / 25) * 0.5), t, 0.8);

    this.worship(f, t);
    this.azaan(f, t);
  }

  /* ---------------- traffic ---------------- */

  private honk(kind: string, x: number, z: number, d: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    const level = 0.5 / (1 + d / 7);
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.panFor(x, z);
    g.connect(pan);
    pan.connect(this.out!);
    // Each vehicle's own: pitch pairs, length, and how many blasts.
    const voice =
      kind === "bus"
        ? { hz: [233, 277], dur: 0.7, blasts: 1, wave: "sawtooth" as OscillatorType }
        : kind === "auto"
          ? { hz: [1050, 1180], dur: 0.12, blasts: 2 + Math.floor(rand() * 2), wave: "square" as OscillatorType }
          : kind === "rickshaw"
            ? { hz: [2350, 3100], dur: 0.07, blasts: 2 + Math.floor(rand() * 2), wave: "sine" as OscillatorType }
            : kind === "bike"
            ? { hz: [720], dur: 0.18, blasts: 2, wave: "square" as OscillatorType }
              : { hz: [415, 523], dur: 0.35 + rand() * 0.35, blasts: rand() < 0.4 ? 2 : 1, wave: "sawtooth" as OscillatorType };
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = voice.hz[0] * 2;
    bp.Q.value = 0.8;
    bp.connect(g);
    for (let b = 0; b < voice.blasts; b++) {
      const at = t + b * (voice.dur + 0.09);
      for (const hz of voice.hz) {
        const o = ctx.createOscillator();
        o.type = voice.wave;
        o.frequency.value = hz * (0.98 + rand() * 0.04);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, at);
        og.gain.linearRampToValueAtTime(level, at + 0.015);
        og.gain.setValueAtTime(level, at + voice.dur - 0.03);
        og.gain.linearRampToValueAtTime(0, at + voice.dur);
        o.connect(og);
        og.connect(bp);
        o.start(at);
        o.stop(at + voice.dur + 0.05);
      }
    }
    setTimeout(() => pan.disconnect(), (voice.blasts * (voice.dur + 0.1) + 1) * 1000);
  }

  /* ---------------- worship ---------------- */

  private worship(f: SoundFrame, t: number) {
    const ctx = this.ctx!;
    // Bells from every temple in earshot, each at its own pace.
    for (const s of this.sites) {
      if (s.kind !== "temple") continue;
      const d = Math.hypot(s.x - f.x, s.z - f.z);
      if (d > 70) continue;
      const due = this.nextBell.get(s) ?? t + rand() * 4;
      if (t >= due) {
        this.bell(s, d);
        this.nextBell.set(s, t + (s.big ? 5 : 8) + rand() * 9);
      } else if (!this.nextBell.has(s)) this.nextBell.set(s, due);
    }

    // A chant (temple) or kirtan (gurdwara) from the nearest one close by.
    const range = (s: Site) => (s.kind === "gurdwara" ? (s.big ? 160 : 60) : s.big ? 70 : 40);
    let near: Site | null = null;
    let nd = Infinity;
    for (const s of this.sites) {
      if (s.kind === "mosque") continue;
      const d = Math.hypot(s.x - f.x, s.z - f.z);
      if (d < range(s) && d < nd) {
        near = s;
        nd = d;
      }
    }
    if (this.chant && this.chant.site !== near) {
      this.chant.gain.gain.setTargetAtTime(0, t, 0.8);
      this.chant.voice.dispose(t + 3);
      this.chant = null;
    }
    if (near && !this.chant && this.music) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.out!);
      gain.connect(this.reverb!);
      this.chant = { voice: held(ctx, gain, "chant"), gain, site: near, next: t + 0.3, step: 0 };
    }
    if (this.chant && this.music) {
      const c = this.chant;
      const level = 0.4 * Math.max(0, 1 - nd / range(c.site));
      c.gain.gain.setTargetAtTime(level, t, 0.6);
      if (t >= c.next) c.next = t + this.phrase(c.voice, t, c.site.kind, c.step++);
    }
  }

  /** One chanted line in the city's raga; returns its length in seconds. */
  private phrase(v: Voice, t: number, kind: SiteKind, step: number): number {
    const m = this.music!;
    const sa = midiToHz(m.sa);
    const has = (s: Swara) => m.raga.swaras.includes(s);
    const second = m.raga.swaras[1];
    const third = m.raga.swaras[2];
    const fifth: Swara = has("P") ? "P" : m.raga.swaras[3];
    // A temple's is the recitation's rise and fall round Sa; a gurdwara's a
    // shabad's line that climbs to the fifth and comes home.
    const lines: [Swara, number, number][][] =
      kind === "temple"
        ? [
            [["S", 0, 1.2], [second, 0, 0.6], ["S", 0, 0.6], ["S", 0, 1.8]],
            [["S", 0, 0.6], [third, 0, 0.9], [second, 0, 0.6], ["S", 0, 1.9]],
          ]
        : [
            [["S", 0, 0.5], [second, 0, 0.5], [third, 0, 0.9], [fifth, 0, 1.4], [third, 0, 0.5], ["S", 0, 1.4]],
            [[fifth, 0, 0.7], [third, 0, 0.5], [second, 0, 0.5], ["S", 0, 1.8]],
          ];
    const line = lines[step % lines.length];
    let at = t;
    for (const [s, o, dur] of line) {
      v.note(at, { hz: swaraHz(sa, s, o), dur, vel: 0.85 });
      at += dur;
    }
    return at - t + 1.2;
  }

  private bell(s: Site, d: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.panFor(s.x, s.z);
    g.connect(pan);
    pan.connect(this.out!);
    pan.connect(this.reverb!);
    const level = 0.35 / (1 + d / 10);
    // A big temple bell, or a quick run of the hand bell.
    const hand = rand() < 0.5;
    const base = hand ? 1320 + rand() * 200 : 520 + rand() * 80;
    const strikes = hand ? 3 + Math.floor(rand() * 4) : 1;
    for (let k = 0; k < strikes; k++) {
      const at = t + k * 0.16;
      for (const [r, a, dec] of [[1, 1, hand ? 0.9 : 3.5], [2.01, 0.45, hand ? 0.6 : 2.5], [2.76, 0.3, hand ? 0.4 : 1.8], [5.4, 0.12, 0.5]]) {
        const o = ctx.createOscillator();
        o.frequency.value = base * r;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, at);
        og.gain.linearRampToValueAtTime(level * a, at + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, at + dec);
        o.connect(og);
        og.connect(g);
        o.start(at);
        o.stop(at + dec + 0.05);
      }
    }
    setTimeout(() => pan.disconnect(), 5000);
  }

  /* ---------------- the azaan ---------------- */

  private azaan(f: SoundFrame, t: number) {
    const due = azaanDue(new Date());
    if (!due) return;
    const key = `${new Date().toDateString()}:${due}`;
    if (this.heard.has(key)) return;
    const mosques = this.sites.filter((s) => s.kind === "mosque");
    if (!mosques.length) return;
    this.heard.add(key);
    // From the nearest mosque, whatever the distance: across the district.
    const m = mosques.reduce((a, b) => (Math.hypot(a.x - f.x, a.z - f.z) < Math.hypot(b.x - f.x, b.z - f.z) ? a : b));
    this.callFrom(m, Math.hypot(m.x - f.x, m.z - f.z), t);
  }

  /** The opening takbir, twice: distant, filtered by the streets between. */
  private callFrom(m: Site, d: number, t: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.08, 0.3 / (1 + d / 120));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1700;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.panFor(m.x, m.z) * 0.6;
    g.connect(lp);
    lp.connect(pan);
    pan.connect(this.out!);
    pan.connect(this.reverb!);
    const v = held(ctx, g, "azaan");
    // A Hijaz-coloured line (komal re, shuddh ga) round a D.
    const sa = 294;
    const at = (s: Swara, o = 0) => swaraHz(sa, s, o);
    const line: [number, number][] = [
      [at("S"), 0.6], [at("G"), 1.4], [at("m"), 0.5], [at("G"), 0.9], [at("r"), 0.45], [at("S"), 1.6],
      [at("S"), 0.5], [at("m"), 1.6], [at("P"), 0.6], [at("m"), 0.7], [at("G"), 0.5], [at("r"), 0.5], [at("S"), 2.2],
    ];
    let time = t + 0.3;
    let prev: number | undefined;
    for (const [hz, dur] of line) {
      v.note(time, { hz, dur, vel: 0.9, slideFrom: prev });
      prev = hz;
      time += dur;
    }
    v.dispose(time + 1);
    setTimeout(() => pan.disconnect(), (time - t + 4) * 1000);
  }

  /* ---------------- helpers ---------------- */

  /** -1 left .. 1 right, from the listener's heading. */
  private panFor(x: number, z: number): number {
    const f = this.last;
    if (!f) return 0;
    const dx = x - f.x;
    const dz = z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    // Right of the heading (sin yaw, cos yaw) is (-cos yaw, sin yaw).
    return Math.max(-1, Math.min(1, ((dx * -Math.cos(f.heading) + dz * Math.sin(f.heading)) / d) * 0.8));
  }

  private noise(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    src.start();
    this.beds.push(src);
    return src;
  }
}

/** One soundscape for the game, like the SFX engine. */
export const ambience = new Ambience();
