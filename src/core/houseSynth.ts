// Instruments for bass-heavy dance tracks: a tuned kick, clap, monophonic sub with glides,
// a formant growl bass and sidechain curves. Additive to synth.ts, which locked songs depend on.
import { SAMPLE_RATE as SR, type Rng } from "./audio";
import type { Bus } from "./synth";

const TAU = 2 * Math.PI;

const put = (b: Bus, i: number, l: number, r: number) => {
  if (i < 0 || i >= b.L.length) return;
  b.L[i] += l;
  b.R[i] += r;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A long, saturated kick whose tail sits on `tailHz`, so it reinforces the song's root. */
export const houseKick = (b: Bus, t: number, vel: number, rnd: Rng, tailHz: number, lengthS = 0.44) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(lengthS * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    phase += (TAU * (tailHz + 230 * Math.exp(-tau / 0.012) + 52 * Math.exp(-tau / 0.05))) / SR;
    const body = Math.sin(phase) * Math.exp(-tau / 0.17);
    const click = (rnd() * 2 - 1) * 0.55 * Math.exp(-tau / 0.002);
    const release = Math.min(1, (len - k) / (0.02 * SR));
    const v = Math.tanh((body * 2.1 + click) * 1.2) * release * vel;
    put(b, i0 + k, v, v);
  }
};

/** Layered noise bursts through a band-pass, like several hands. */
export const clap = (b: Bus, t: number, vel: number, rnd: Rng, pan = 0.5) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(0.28 * SR);
  const f = 2 * Math.sin((Math.PI * 1500) / SR);
  const BURSTS = [0, 0.011, 0.022, 0.033];
  let low = 0;
  let band = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const high = rnd() * 2 - 1 - low - 0.6 * band;
    band += f * high;
    low += f * band;
    let env = 0.75 * Math.exp(-Math.max(0, tau - 0.033) / 0.085) * (tau >= 0.033 ? 1 : 0);
    for (const at of BURSTS) if (tau >= at) env = Math.max(env, Math.exp(-(tau - at) / 0.006));
    const v = band * env * vel;
    put(b, i0 + k, v * (1 - pan) * 2, v * pan * 2);
  }
};

export type SubNote = { t: number; durS: number; hz: number; vel?: number; fromHz?: number; glideS?: number };

/**
 * A monophonic sine bass with continuous phase. Pitch glides in log frequency, so slides sound
 * even, and the gate is slewed so notes never click. Light saturation adds the 2nd and 3rd
 * harmonics that let a small speaker suggest the fundamental.
 */
export const subLine = (b: Bus, notes: SubNote[], drive = 1.5, gateS = 0.005) => {
  const sorted = [...notes].sort((x, y) => x.t - y.t);
  const n = b.L.length;
  const gateCoef = 1 - Math.exp(-1 / (gateS * SR));
  const norm = Math.tanh(drive);
  let idx = -1;
  let phase = 0;
  let logHz = Math.log(sorted[0].hz);
  let gate = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (idx + 1 < sorted.length && sorted[idx + 1].t <= t) {
      idx++;
      if (sorted[idx].fromHz !== undefined) logHz = Math.log(sorted[idx].fromHz as number);
    }
    const note = idx >= 0 ? sorted[idx] : undefined;
    const active = note !== undefined && t < note.t + note.durS;
    if (note) {
      const glide = note.glideS ?? 0.012;
      logHz += (Math.log(note.hz) - logHz) * (1 - Math.exp(-1 / (glide * SR)));
    }
    gate += ((active ? (note?.vel ?? 1) : 0) - gate) * gateCoef;
    if (gate < 1e-5 && !active) continue;
    phase += (TAU * Math.exp(logHz)) / SR;
    const v = (Math.tanh(Math.sin(phase) * drive) / norm) * gate;
    put(b, i, v, v);
  }
};

/** Vowel formants as [F1, F2] in Hz, from a closed "oo" through "ah" to a nasal "ee". */
const VOWELS: [number, number][] = [
  [310, 780],
  [760, 1180],
  [420, 2100],
];

const vowelAt = (v: number): [number, number] => {
  const x = clamp01(v) * (VOWELS.length - 1);
  const i = Math.min(VOWELS.length - 2, Math.floor(x));
  const u = x - i;
  return [VOWELS[i][0] + (VOWELS[i + 1][0] - VOWELS[i][0]) * u, VOWELS[i][1] + (VOWELS[i + 1][1] - VOWELS[i][1]) * u];
};

const saw = (p: number) => 2 * (p - Math.floor(p)) - 1;

export type GrowlOptions = {
  /** Vowel position (0 "oo", 0.5 "ah", 1 "ee") over the note: u runs 0..1, tauS is seconds. */
  vowel: (u: number, tauS: number) => number;
  drive?: number;
  detune?: number;
  /** Semitones the note falls from at its start. */
  diveSemis?: number;
  diveS?: number;
  resonance?: number;
  highpassHz?: number;
  attackS?: number;
  releaseS?: number;
};

/**
 * Distorted saw stack through two moving formant filters: the talking mid bass of bass house.
 * It carries no sub of its own, so the bass stays clean below the high-pass.
 */
export const growl = (b: Bus, t: number, durS: number, hz: number, vel: number, o: GrowlOptions) => {
  const i0 = Math.round(t * SR);
  const attack = Math.round((o.attackS ?? 0.003) * SR);
  const release = Math.round((o.releaseS ?? 0.018) * SR);
  const hold = Math.round(durS * SR);
  const len = hold + release;
  const detune = o.detune ?? 1.009;
  const drive = o.drive ?? 5;
  const damp = 2 / (o.resonance ?? 7);
  const hp = 1 - Math.exp((-TAU * (o.highpassHz ?? 95)) / SR);
  const diveSemis = o.diveSemis ?? 0;
  const diveS = o.diveS ?? 0.06;
  // Separate phases and filters per side give width above the mono sub.
  const phases = [0, 0.31, 0.57, 0.83];
  const state = [
    { l1: 0, b1: 0, l2: 0, b2: 0, dc: 0 },
    { l1: 0, b1: 0, l2: 0, b2: 0, dc: 0 },
  ];
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const u = k / Math.max(1, hold);
    const f = hz * 2 ** ((diveSemis * Math.exp(-tau / diveS)) / 12);
    phases[0] += f / SR;
    phases[1] += (f * detune) / SR;
    phases[2] += f / SR;
    phases[3] += f / detune / SR;
    const [F1, F2] = vowelAt(o.vowel(clamp01(u), tau));
    const c1 = 2 * Math.sin((Math.PI * Math.min(6000, F1)) / SR);
    const c2 = 2 * Math.sin((Math.PI * Math.min(6000, F2)) / SR);
    const out = [0, 0];
    for (let side = 0; side < 2; side++) {
      const s = state[side];
      const raw = Math.tanh((saw(phases[side * 2]) + saw(phases[side * 2 + 1])) * drive);
      const h1 = raw - s.l1 - damp * s.b1;
      s.b1 += c1 * h1;
      s.l1 += c1 * s.b1;
      const h2 = raw - s.l2 - damp * s.b2;
      s.b2 += c2 * h2;
      s.l2 += c2 * s.b2;
      const mixed = s.b1 + 0.7 * s.b2;
      s.dc += (mixed - s.dc) * hp;
      out[side] = Math.tanh((mixed - s.dc) * 1.6);
    }
    const a = k < attack ? k / attack : 1;
    const rel = k < hold ? 1 : 1 - (k - hold) / release;
    const gain = a * rel * vel;
    put(b, i0 + k, out[0] * gain, out[1] * gain);
  }
};

/** Sidechain gain: drops at each hit, holds, then recovers. A short pre-ramp keeps it click-free. */
export const sidechain = (n: number, hits: number[], depth: number, holdS: number, recoverS: number): Float32Array => {
  const gain = new Float32Array(n).fill(1);
  const from = Math.round(0.002 * SR);
  for (const t of hits) {
    const i0 = Math.round(t * SR);
    const span = Math.round((holdS + recoverS * 6) * SR);
    for (let k = -from; k < span; k++) {
      const i = i0 + k;
      if (i < 0 || i >= n) continue;
      const age = k / SR;
      let g = 1 - depth;
      if (k < 0) g = 1 - depth * (1 + k / from);
      else if (age > holdS) g = 1 - depth * Math.exp(-(age - holdS) / recoverS);
      gain[i] = Math.min(gain[i], g);
    }
  }
  return gain;
};

export const applyGain = (b: Bus, gain: Float32Array) => {
  for (let i = 0; i < b.L.length; i++) {
    b.L[i] *= gain[i];
    b.R[i] *= gain[i];
  }
};
