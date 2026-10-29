// Scenario clips for the player: short scored timelines that drive the real model.
//
// A clip is a list of beats (caption, camera shot, which parts X-ray shows) plus keyframe
// tracks on a handful of channels. The engine samples the clip at any time, so the slider
// can scrub anywhere and the scene just lands in that state. Segments (dispense, drink,
// confirm…) are functions on a Clip, so "a full dose" is three of them back to back.

export type Hue = "warm" | "amber" | "green" | "coral";
const HUES: Hue[] = ["warm", "amber", "green", "coral"];

export type Ease = "io" | "in" | "out" | "linear" | "step";
interface Key { t: number; v: number; e: Ease }

export interface Shot { target: [number, number, number]; dir: [number, number, number]; r: number }

export interface Beat {
  t0: number; t1: number;
  caption: string;
  note?: string;                 // a few words at most, only where it earns its place
  shot: Shot;
  xray: number;
  focus: string[];               // parts that stay solid (or, if internal, show) under X-ray
  result?: "ok" | "miss";
}

export type Channel =
  | "sip" | "eaten" | "deck1" | "deck2" | "shutter" | "magnet" | "tof" | "dose"
  | "halo" | "haloHue" | "exhale" | "sample" | "sensor" | "sensorHue" | "spit"
  | "load" | "feed" | "wrap" | "shuttle" | "tip" | "lift" | "push";

/** Resting value of each channel when a clip never keys it. */
const REST: Record<Channel, number> = {
  sip: 0, eaten: 0, deck1: 0, deck2: 0, shutter: 0, magnet: 0, tof: 0, dose: 6,
  halo: 0, haloHue: 0, exhale: 0, sample: 0, sensor: 0, sensorHue: 0, spit: 0,
  load: 0, feed: 0, wrap: 0, shuttle: 0, tip: 0, lift: 1, push: 0,
};

export interface SceneState {
  t: number;
  beat: number;
  xray: number;
  focus: Set<string>;
  marker: boolean;               // whether this breath carries the marker's by-product
  v: Record<Channel, number>;
  dose: [number, number, number]; // station along the dose path, per capsule (staggered)
  hue: Hue; sensorHue: Hue;
}

export interface Scenario {
  id: string; title: string; line: string; icon: Icon;
  duration: number; beats: Beat[];
  sample(t: number): SceneState;
}

export type Icon = "full" | "dispense" | "drink" | "breath" | "miss" | "load";

const EASE: Record<Ease, (x: number) => number> = {
  io: (x) => x * x * (3 - 2 * x),
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  linear: (x) => x,
  step: () => 0,
};

function sampleTrack(keys: Key[] | undefined, t: number, rest: number): number {
  if (!keys || keys.length === 0) return rest;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t < b.t) {
      const a = keys[i - 1];
      return a.v + (b.v - a.v) * EASE[b.e]((t - a.t) / (b.t - a.t));
    }
  }
  return keys[keys.length - 1].v;
}

// ── Camera shots (world mm; the engine sizes the distance to the radius) ──────────────
const S = {
  wide: { target: [14, 150, -30], dir: [1.1, 0.5, 1.0], r: 175 },
  magazine: { target: [16, 172, -80], dir: [0.55, 1, 0.65], r: 62 },
  drop: { target: [22, 140, -60], dir: [1.15, 0.35, 0.8], r: 62 },
  outlet: { target: [0, 117, -44], dir: [0.85, 0.35, -0.8], r: 40 },
  lid: { target: [0, 114, -12], dir: [1, 0.55, 0.45], r: 52 },
  drinker: { target: [0, 190, 92], dir: [1, 0.12, 0.06], r: 150 },
  spout: { target: [0, 236, 140], dir: [1, 0.18, 0.12], r: 70 },
  breathe: { target: [0, 256, 164], dir: [1, 0.2, 0.1], r: 64 },
  lips: { target: [0, 236, 186], dir: [1, 0.15, 0.2], r: 80 },
  sample: { target: [8, 118, -46], dir: [1, 0.3, 0.28], r: 44 },
  front: { target: [0, 170, -20], dir: [0.35, 0.28, 1], r: 150 },
  feed: { target: [-48, 250, -48], dir: [-0.9, 0.6, 1], r: 58 },
  press: { target: [-50, 102, -56], dir: [-1, 0.4, 0.9], r: 44 },
  lift: { target: [-42, 150, -70], dir: [-1, 0.35, 0.75], r: 92 },
  file: { target: [-26, 196, -86], dir: [-0.45, 1, 0.5], r: 46 },
} satisfies Record<string, Shot>;

// Parts that each stage keeps visible under X-ray.
const F = {
  dose: ["mouthful", "magazine-deck-1", "index-drive", "port-shutter", "outlet", "ramp", "well", "grill"],
  gate: ["mouthful", "port-shutter", "outlet", "shutter-magnet", "ramp", "well", "grill"],
  land: ["mouthful", "port-shutter", "outlet", "grill-sensor", "ramp", "well", "grill"],
  drink: ["mouthful", "water", "well", "grill", "ramp"],
  sample: ["port-shutter", "outlet", "shutter-magnet", "breath-sensor", "ramp", "well"],
  load: ["wrap-station", "feed-slot", "magazine-deck-2"],
};

class Clip {
  beats: Beat[] = [];
  tracks: Partial<Record<Channel, Key[]>> = {};
  at = 0;
  marker = false;

  beat(dur: number, caption: string, shot: Shot, xray: number, focus: string[], fn?: (k: (ch: Channel, dt: number, v: number, e?: Ease) => void) => void, extra: Partial<Beat> = {}) {
    const t0 = this.at;
    this.beats.push({ t0, t1: t0 + dur, caption, shot, xray, focus, ...extra });
    fn?.((ch, dt, v, e = "io") => this.key(ch, t0 + dt, v, e));
    this.at += dur;
    return this;
  }
  key(ch: Channel, t: number, v: number, e: Ease = "io") {
    (this.tracks[ch] ??= []).push({ t, v, e });
    this.tracks[ch]!.sort((a, b) => a.t - b.t);
  }
  /** Pin a channel's value at the current time (so a segment starts from a known state). */
  set(ch: Channel, v: number) { this.key(ch, this.at, v, "step"); }

  build(id: string, title: string, line: string, icon: Icon): Scenario {
    const { beats, tracks } = this;
    const duration = this.at;
    const marker = this.marker;
    const ch = Object.keys(REST) as Channel[];
    return {
      id, title, line, icon, duration, beats,
      sample(t: number): SceneState {
        t = Math.min(Math.max(t, 0), duration);
        let beat = beats.findIndex((b) => t < b.t1);
        if (beat < 0) beat = beats.length - 1;
        const v = {} as Record<Channel, number>;
        for (const c of ch) v[c] = sampleTrack(tracks[c], t, REST[c]);
        // Capsules leave single file: the same track, each a little later.
        const d = (i: number) => sampleTrack(tracks.dose, t - i * 0.2, REST.dose);
        const b = beats[beat];
        return {
          t, beat, v, marker, xray: b.xray, focus: new Set(b.focus),
          dose: [d(0), d(1), d(2)],
          hue: HUES[Math.round(v.haloHue)], sensorHue: HUES[Math.round(v.sensorHue)],
        };
      },
    };
  }
}

// ── Segments ───────────────────────────────────────────────────────────
// Dose path stations: 0 cell, 1 drop channel top, 2 channel foot, 3 outlet, 4 ramp top, 5 ramp foot, 6 grill.

function dispense(c: Clip) {
  c.set("dose", 0); c.set("eaten", 0); c.set("haloHue", 1); c.set("halo", 0); c.set("deck1", -2 * Math.PI / 7);
  c.beat(2.4, "Dose time", S.wide, 0, [], (k) => {
    k("halo", 0.2, 1); k("halo", 0.9, 0.55); k("halo", 1.6, 1); k("halo", 2.3, 0.6);
  });
  c.beat(2.2, "The deck turns to the drop", S.magazine, 1, F.dose, (k) => {
    k("deck1", 0.3, -2 * Math.PI / 7); k("deck1", 1.8, 0);
  });
  c.beat(2.0, "A magnet opens the lid", S.outlet, 1, F.gate, (k) => {
    k("magnet", 0.2, 0); k("magnet", 0.6, 1); k("shutter", 0.4, 0); k("shutter", 1.1, 1);
  });
  c.beat(2.2, "It drops past the beam", S.drop, 1, F.dose, (k) => {
    k("dose", 0.2, 0); k("dose", 0.7, 1, "io"); k("dose", 1.1, 2, "in"); k("dose", 2.2, 3, "linear");
  });
  c.beat(2.4, "Down the ramp, onto the grill", S.lid, 1, F.land, (k) => {
    k("dose", 0.5, 4, "linear"); k("dose", 1.3, 5, "in"); k("dose", 1.8, 6, "out");
    k("shutter", 1.9, 1); k("shutter", 2.4, 0); k("magnet", 1.9, 1); k("magnet", 2.4, 0);
  });
  c.beat(2.2, "Seen landing", S.lid, 1, F.land, (k) => {
    k("tof", 0, 0); k("tof", 0.4, 1); k("tof", 1.9, 1); k("tof", 2.2, 0);
  }, { note: "Distance sensor, no camera" });
}

function drink(c: Clip, final = true) {
  c.set("dose", 6); c.set("eaten", 0); c.set("sip", 0);
  c.beat(2.6, "Lift and tip", S.drinker, 0.6, F.drink, (k) => {
    k("sip", 0.2, 0); k("sip", 2.6, 0.62); k("halo", 0, c.at > 0 ? 1 : 0); k("halo", 1, 0.25);
  });
  c.beat(2.2, "Water reaches the grill", S.spout, 1, F.drink, (k) => { k("sip", 2.2, 0.8, "linear"); });
  c.beat(2.2, "Down with the first sip", S.lips, 1, F.drink, (k) => { k("sip", 2.0, 1, "out"); k("eaten", 2.1, 1, "step"); });
  if (final) c.beat(2.4, "Back on the dock", S.wide, 0, [], (k) => { k("sip", 0.2, 1); k("sip", 2.2, 0); });
}

function spitOut(c: Clip) {
  c.beat(2.2, "Spat out", S.lips, 1, F.drink, (k) => {
    k("spit", 0.1, 0); k("spit", 1.4, 1, "linear"); k("sip", 0.4, 1); k("sip", 2.2, 0.45);
  });
  c.beat(1.6, "Back on the dock", S.wide, 0, [], (k) => { k("sip", 1.4, 0); });
}

function breathCheck(c: Clip, found: boolean) {
  c.marker = found;
  c.set("exhale", 0); c.set("sample", 0); c.set("sip", 0); c.set("eaten", 1); c.set("haloHue", 0);
  c.beat(2.2, "Ten minutes later…", S.wide, 0, [], (k) => {
    k("halo", 0, 0); k("halo", 0.6, 0.7); k("halo", 1.3, 0.3); k("halo", 2.0, 0.7);
  }, { note: "The halo asks for a sip" });
  c.beat(3.0, "A sip, and a breath", S.breathe, 1, ["water"], (k) => {
    k("sip", 0.1, 0); k("sip", 1.4, 0.7); k("sip", 2.4, 0.7); k("sip", 3.0, 0.3);
    k("exhale", 1.0, 0); k("exhale", 2.6, 1, "linear"); k("halo", 0.4, 0);
  });
  c.beat(1.6, "Back on the dock", S.lid, 0.6, ["water", "port-shutter"], (k) => { k("sip", 1.2, 0); });
  c.beat(3.0, "The tower samples the lid air", S.sample, 1, F.sample, (k) => {
    k("magnet", 0, 0); k("magnet", 0.4, 1); k("shutter", 0.2, 0); k("shutter", 0.8, 1);
    k("sample", 0.6, 0); k("sample", 2.9, 1, "linear"); k("sensor", 0.8, 0); k("sensor", 2.8, 0.4, "linear");
  });
  c.set("haloHue", found ? 2 : 3); c.set("sensorHue", found ? 2 : 3);
  c.beat(3.0, found ? "Marker found: swallowed" : "No marker: didn't go down", found ? S.front : S.front, 0, [], (k) => {
    k("sensor", 0.3, 1); k("shutter", 0.2, 1); k("shutter", 0.7, 0); k("magnet", 0.7, 0);
    k("halo", 0.1, 0); k("halo", 0.7, 1);
  }, { result: found ? "ok" : "miss", note: found ? "Logged in MedSync" : "A retake is safe" });
}

function load(c: Clip) {
  c.set("load", 1); c.set("feed", 0); c.set("deck2", 0);
  c.beat(2.2, "Drop in a tablet", S.feed, 1, F.load, (k) => { k("feed", 0.3, 0); k("feed", 1.0, 0.18, "out"); k("feed", 2.2, 0.55, "in"); });
  c.beat(1.8, "Size checked", S.press, 1, F.load, (k) => { k("feed", 1.2, 1, "in"); });
  c.beat(2.4, "Sealed in a marker pod", S.press, 1, F.load, (k) => { k("wrap", 0.2, 0); k("wrap", 2.1, 1, "linear"); });
  c.beat(2.4, "Carried to the lift", S.lift, 1, F.load, (k) => {
    k("shuttle", 0.2, 0); k("shuttle", 1.3, 1); k("lift", 0, 1); k("lift", 1.3, 0); k("tip", 1.3, 0); k("tip", 2.2, 1);
  });
  c.beat(2.4, "Lifted to its cell", S.lift, 1, F.load, (k) => {
    k("lift", 0.2, 0); k("lift", 2.0, 1); k("deck2", 0.4, 0); k("deck2", 2.0, 2 * Math.PI / 7);
  });
  c.beat(2.4, "Filed for the week", S.file, 1, F.load, (k) => { k("push", 0.2, 0); k("push", 1.3, 1); });
}

function clip(fn: (c: Clip) => void) { const c = new Clip(); fn(c); return c; }

export const SCENARIOS: Scenario[] = [
  clip((c) => { dispense(c); drink(c); breathCheck(c, true); }).build("full", "A full dose", "Drop, drink, confirm", "full"),
  clip(dispense).build("dispense", "Dispense", "Tower to grill", "dispense"),
  clip((c) => drink(c)).build("drink", "Drink", "Grill to mouth", "drink"),
  clip((c) => breathCheck(c, true)).build("breath", "Breath check", "Marker found", "breath"),
  clip((c) => { drink(c, false); spitOut(c); breathCheck(c, false); }).build("miss", "Spat out", "No marker, safe retake", "miss"),
  clip(load).build("load", "Load the week", "Tablet to pod to cell", "load"),
];
