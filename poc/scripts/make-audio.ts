// Synthesizes public/audio.wav from the same physics the video uses.
// Slowed sections: one thump per firing event. Real speed: one short exhaust
// pulse per event, so 870 events/s literally becomes an 870 Hz tone.
// Run: npx tsx scripts/make-audio.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { BANGS, DURATION_S, isSlowed, REAL_SPEED_START, SLOW_START } from "../src/physics";

const SR = 48000;
const N = Math.ceil(DURATION_S * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// deterministic noise
let seed = 1234567;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

// ---------- engine: slowed thumps ----------
const engSlowL = new Float32Array(N);
const engSlowR = new Float32Array(N);
for (const b of BANGS) {
  if (!isSlowed(b.t)) continue;
  const right = b.cyl <= 6;
  const base = right ? 104 : 90;
  const pan = right ? 0.62 : 0.38;
  const i0 = Math.round(b.t * SR);
  const len = Math.round(0.26 * SR);
  let phase = 0;
  for (let k = 0; k < len && i0 + k < N; k++) {
    const tau = k / SR;
    const f = base + 60 * Math.exp(-tau / 0.012);
    phase += (2 * Math.PI * f) / SR;
    const body = 0.75 * Math.sin(phase) * Math.exp(-tau / 0.055);
    const click = (rnd() * 2 - 1) * 0.45 * Math.exp(-tau / 0.005);
    const snap = 0.18 * Math.sin(2 * Math.PI * 2100 * tau) * Math.exp(-tau / 0.004);
    const s = body + click + snap;
    engSlowL[i0 + k] += s * (1 - pan) * 2;
    engSlowR[i0 + k] += s * pan * 2;
  }
}

// ---------- engine: real-speed pulse train ----------
const engFast = new Float32Array(N);
for (const b of BANGS) {
  if (isSlowed(b.t)) continue;
  const i0 = Math.round(b.t * SR);
  const bankGain = b.cyl <= 6 ? 1.0 : 0.86; // the two banks differ slightly -> f/2 growl
  const len = Math.round(0.006 * SR);
  const jitter = 0.9 + 0.2 * rnd();
  for (let k = 0; k < len && i0 + k < N; k++) {
    const tau = k / SR;
    const p = Math.exp(-tau / 0.0007) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 1500 * tau)) + (rnd() * 2 - 1) * 0.12 * Math.exp(-tau / 0.002);
    engFast[i0 + k] += p * bankGain * jitter;
  }
}
// remove DC and tame the top end, then a little saturation
{
  let lp = 0;
  let dc = 0;
  const a = 1 - Math.exp((-2 * Math.PI * 4200) / SR);
  for (let i = 0; i < N; i++) {
    dc += (engFast[i] - dc) * 0.0015;
    lp += (engFast[i] - dc - lp) * a;
    engFast[i] = Math.tanh(lp * 1.6);
  }
}

// ---------- music bed: A minor, 120 BPM ----------
const bedL = new Float32Array(N);
const bedR = new Float32Array(N);
const prog = [110.0, 87.31, 130.81, 98.0]; // A2 F2 C3 G2, one bar (2 s) each
const chordTones = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [261.63, 329.63, 392.0],
  [196.0, 246.94, 293.66],
];
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const bar = Math.floor(t / 2) % 4;
  const eighth = (t % 0.25) / 0.25;
  const f = prog[bar];
  const env = Math.exp(-eighth * 4);
  const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
  const bass = tri * env * 0.5;
  let pad = 0;
  for (const ft of chordTones[bar]) pad += Math.sin(2 * Math.PI * ft * t) * 0.06 + Math.sin(2 * Math.PI * ft * 1.003 * t) * 0.04;
  const v = bass + pad;
  bedL[i] = v;
  bedR[i] = v * 0.96;
}

// ---------- whooshes on speed changes ----------
const whoosh = (at: number, up: boolean) => {
  const len = Math.round(0.6 * SR);
  const i0 = Math.round((at - 0.35) * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const u = k / len;
    const fc = up ? 300 + 5000 * u : 5300 - 5000 * u;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    lp += (rnd() * 2 - 1 - lp) * a;
    const env = Math.sin(Math.PI * u) ** 2;
    const i = i0 + k;
    if (i >= 0 && i < N) {
      L[i] += lp * env * 0.5;
      R[i] += lp * env * 0.5;
    }
  }
};
whoosh(SLOW_START, false);
whoosh(REAL_SPEED_START, true);

// ---------- mix ----------
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fastOn = !isSlowed(t);
  const bedGain = fastOn ? 0.16 : 0.32;
  const fastGain = 0.55;
  const slowGain = 0.8;
  const fadeIn = smooth(t / 0.08);
  const fadeOut = 1 - smooth((t - (DURATION_S - 0.6)) / 0.6);
  const l = L[i] + engSlowL[i] * slowGain + engFast[i] * fastGain + bedL[i] * bedGain;
  const r = R[i] + engSlowR[i] * slowGain + engFast[i] * fastGain + bedR[i] * bedGain;
  L[i] = Math.tanh(l * 0.9) * fadeIn * fadeOut;
  R[i] = Math.tanh(r * 0.9) * fadeIn * fadeOut;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.72 / peak; // headroom so AAC encoding can't clip

// ---------- write 16-bit stereo WAV ----------
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
mkdirSync("public", { recursive: true });
writeFileSync("public/audio.wav", buf);
const slowCount = BANGS.filter((b) => isSlowed(b.t)).length;
console.log(`wrote public/audio.wav: ${DURATION_S}s, ${BANGS.length} bangs (${slowCount} slowed), peak norm ${norm.toFixed(2)}`);
