// A small offline instrument set for episode soundtracks: drums and subtractive synth voices.
// Everything writes into stereo buses at exact sample positions, so hits land exactly where asked.
import { SAMPLE_RATE as SR, type Rng } from "./audio";

export type Bus = { L: Float32Array; R: Float32Array };
export const newBus = (n: number): Bus => ({ L: new Float32Array(n), R: new Float32Array(n) });

const put = (b: Bus, i: number, v: number, pan: number) => {
  if (i < 0 || i >= b.L.length) return;
  b.L[i] += v * (1 - pan) * 2;
  b.R[i] += v * pan * 2;
};

export const mixInto = (target: Bus, source: Bus, gain: number) => {
  for (let i = 0; i < target.L.length; i++) {
    target.L[i] += source.L[i] * gain;
    target.R[i] += source.R[i] * gain;
  }
};

/** Equal-tempered frequency of a MIDI note, for a song tuned so A4 = a4Hz. */
export const midiHz = (midi: number, a4Hz: number) => a4Hz * 2 ** ((midi - 69) / 12);

export const kick = (b: Bus, t: number, vel: number, rnd: Rng) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(0.32 * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    phase += (2 * Math.PI * (48 + 130 * Math.exp(-tau / 0.03))) / SR;
    const click = (rnd() * 2 - 1) * 0.35 * Math.exp(-tau / 0.003);
    put(b, i0 + k, (Math.sin(phase) * Math.exp(-tau / 0.13) + click) * vel, 0.5);
  }
};

export const snare = (b: Bus, t: number, vel: number, rnd: Rng, pan = 0.5) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(0.24 * SR);
  let prev = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const n = rnd() * 2 - 1;
    const bright = n - prev * 0.6;
    prev = n;
    const body = Math.sin(2 * Math.PI * 196 * tau) * 0.55 * Math.exp(-tau / 0.05);
    put(b, i0 + k, (bright * 0.5 * Math.exp(-tau / 0.085) + body) * vel, pan);
  }
};

export const hat = (b: Bus, t: number, vel: number, decayS: number, rnd: Rng, pan = 0.5) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(Math.min(0.5, decayS * 6) * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const n = rnd() * 2 - 1;
    lp += (n - lp) * 0.55;
    put(b, i0 + k, (n - lp) * Math.exp(-tau / decayS) * vel, pan);
  }
};

export const tom = (b: Bus, t: number, hz: number, vel: number, pan = 0.5) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(0.26 * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    phase += (2 * Math.PI * hz * (1 + 0.7 * Math.exp(-tau / 0.02))) / SR;
    put(b, i0 + k, Math.sin(phase) * Math.exp(-tau / 0.09) * vel, pan);
  }
};

export const crash = (b: Bus, t: number, vel: number, rnd: Rng) => {
  const i0 = Math.round(t * SR);
  const len = Math.round(2.2 * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const n = rnd() * 2 - 1;
    lp += (n - lp) * 0.4;
    const v = (n - lp) * Math.exp(-tau / 0.55) * vel;
    put(b, i0 + k, v, 0.5 + 0.25 * Math.sin(k * 0.003));
  }
};

/** Noise sweep rising (or falling) across a span, ending exactly at `to`. */
export const riser = (b: Bus, from: number, to: number, vel: number, rising: boolean, rnd: Rng) => {
  const i0 = Math.round(from * SR);
  const len = Math.round((to - from) * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const u = k / len;
    const fc = rising ? 200 + 7000 * u * u : 7200 - 7000 * u;
    lp += (rnd() * 2 - 1 - lp) * (1 - Math.exp((-2 * Math.PI * fc) / SR));
    put(b, i0 + k, lp * (rising ? u * u : (1 - u) ** 2) * vel, 0.5);
  }
};

export type Wave = "saw" | "square" | "pulse" | "tri";

export type Voice = {
  wave: Wave;
  /** Second oscillator's detune ratio; 1 for a single oscillator. */
  detune: number;
  cutoffHz: number;
  /** Extra cutoff at the note's start, decaying with filterTau. */
  cutoffEnvHz: number;
  filterTau: number;
  attackS: number;
  decayTau: number;
  sustain: number;
  releaseS: number;
  vibratoHz?: number;
  vibratoDepth?: number;
};

const osc = (wave: Wave, p: number) => {
  const x = p - Math.floor(p);
  if (wave === "saw") return 2 * x - 1;
  if (wave === "square") return x < 0.5 ? 1 : -1;
  if (wave === "pulse") return x < 0.25 ? 1 : -1;
  return 4 * Math.abs(x - 0.5) - 1;
};

export const playNote = (b: Bus, t: number, durS: number, hz: number, vel: number, v: Voice, pan = 0.5) => {
  const i0 = Math.round(t * SR);
  const hold = Math.round(durS * SR);
  const release = Math.round(v.releaseS * SR);
  const len = hold + release;
  let p1 = 0;
  let p2 = 0.37;
  let lp1 = 0;
  let lp2 = 0;
  for (let k = 0; k < len; k++) {
    const tau = k / SR;
    const vib = v.vibratoHz ? 1 + (v.vibratoDepth ?? 0) * Math.sin(2 * Math.PI * v.vibratoHz * tau) * Math.min(1, tau / 0.2) : 1;
    p1 += (hz * vib) / SR;
    p2 += (hz * vib * v.detune) / SR;
    const raw = v.detune === 1 ? osc(v.wave, p1) : (osc(v.wave, p1) + osc(v.wave, p2)) * 0.5;
    const fc = Math.min(16000, v.cutoffHz + v.cutoffEnvHz * Math.exp(-tau / v.filterTau));
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    lp1 += (raw - lp1) * a;
    lp2 += (lp1 - lp2) * a;
    const attack = Math.min(1, tau / v.attackS);
    const body = v.sustain + (1 - v.sustain) * Math.exp(-tau / v.decayTau);
    const rel = k < hold ? 1 : 1 - (k - hold) / release;
    put(b, i0 + k, lp2 * attack * body * rel * vel, pan);
  }
};

/** Ping-pong echo: reads `send` and writes the echoes into `out`. */
export const pingPongDelay = (send: Bus, out: Bus, delayS: number, feedback: number) => {
  const d = Math.round(delayS * SR);
  const n = send.L.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = d; i < n; i++) {
    left[i] = send.R[i - d] + right[i - d] * feedback;
    right[i] = send.L[i - d] + left[i - d] * feedback;
    out.L[i] += left[i];
    out.R[i] += right[i];
  }
};
