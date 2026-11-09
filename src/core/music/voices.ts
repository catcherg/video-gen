// Extra instruments for dubstep. Additive, so locked songs built on synth.ts and houseSynth.ts can't change.
import { SAMPLE_RATE as SR, type Rng } from "../audio";
import type { Bus } from "../synth";

const TAU = 2 * Math.PI;

const put = (b: Bus, i: number, l: number, r: number) => {
  if (i < 0 || i >= b.L.length) return;
  b.L[i] += l;
  b.R[i] += r;
};

const saw = (p: number) => 2 * (p - Math.floor(p)) - 1;
const square = (p: number) => (p - Math.floor(p) < 0.5 ? 1 : -1);

export type WobbleOptions = {
  /** Filter sweeps per second. */
  ratePerS: number;
  drive?: number;
  resonance?: number;
  /** Cutoff range of the sweep. */
  lowHz?: number;
  highHz?: number;
  /** Semitones the note falls from at its start. */
  diveSemis?: number;
  diveS?: number;
};

/**
 * Distorted saw and square through a resonant low-pass whose cutoff is swept in time with the song.
 * The sweep starts closed on the note, so every note speaks with a "wub". It carries no sub of its own.
 */
export const wobble = (b: Bus, t: number, durS: number, hz: number, vel: number, o: WobbleOptions) => {
  const i0 = Math.round(t * SR);
  const hold = Math.round(durS * SR);
  const release = Math.round(0.012 * SR);
  const attack = Math.round(0.002 * SR);
  const len = hold + release;
  const drive = o.drive ?? 7;
  const damp = 2 / (o.resonance ?? 6);
  const lowHz = o.lowHz ?? 260;
  const highHz = o.highHz ?? 3400;
  const diveSemis = o.diveSemis ?? 0;
  const diveS = o.diveS ?? 0.05;
  const hp = 1 - Math.exp((-TAU * 95) / SR);
  const phases = [0, 0.41, 0.23, 0.67];
  const state = [
    { low: 0, band: 0, dc: 0 },
    { low: 0, band: 0, dc: 0 },
  ];
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const f = hz * 2 ** ((diveSemis * Math.exp(-tau / diveS)) / 12);
    phases[0] += f / SR;
    phases[1] += (f * 1.008) / SR;
    phases[2] += f / SR;
    phases[3] += (f / 1.008) / SR;
    const sweep = 0.5 - 0.5 * Math.cos(TAU * o.ratePerS * tau);
    const cutoff = Math.min(7000, lowHz * (highHz / lowHz) ** sweep);
    const c = 2 * Math.sin((Math.PI * cutoff) / SR);
    const out = [0, 0];
    for (let side = 0; side < 2; side++) {
      const s = state[side];
      const raw = Math.tanh((saw(phases[side * 2]) + 0.8 * square(phases[side * 2 + 1])) * drive);
      const high = raw - s.low - damp * s.band;
      s.band += c * high;
      s.low += c * s.band;
      s.dc += (s.low - s.dc) * hp;
      out[side] = Math.tanh((s.low - s.dc) * 2.2);
    }
    const gate = (k < attack ? k / attack : 1) * (k < hold ? 1 : 1 - (k - hold) / release) * vel;
    put(b, i0 + k, out[0] * gate, out[1] * gate);
  }
};

/** A short mid-range click layered on a kick. Phone speakers can't play the kick's body, so this is what they punch with. */
export const kickTop = (b: Bus, t: number, vel: number, rnd: Rng) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(0.04 * SR);
  let phase = 0;
  let previous = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    phase += (TAU * (280 + 1500 * Math.exp(-tau / 0.008))) / SR;
    const noise = rnd() * 2 - 1;
    const bright = noise - previous * 0.7;
    previous = noise;
    const v = Math.tanh(Math.sin(phase) * 2.4 + bright * 0.7 * Math.exp(-tau / 0.004)) * Math.exp(-tau / 0.014) * vel;
    put(b, i0 + k, v, v);
  }
};

/** One enormous hit for the start of a drop: a sine falling from far above the note, plus a burst of noise. */
export const impact = (b: Bus, t: number, hz: number, vel: number, rnd: Rng, lengthS = 1.5) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(lengthS * SR);
  let phase = 0;
  let noise = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    phase += (TAU * hz * (1 + 11 * Math.exp(-tau / 0.035))) / SR;
    noise += (rnd() * 2 - 1 - noise) * 0.3;
    const tail = Math.min(1, (len - k) / (0.05 * SR));
    const v = (Math.tanh(Math.sin(phase) * 3) * Math.exp(-tau / 0.55) + noise * 1.1 * Math.exp(-tau / 0.06)) * tail * vel;
    put(b, i0 + k, v, v);
  }
};
