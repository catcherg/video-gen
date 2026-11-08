// Offline audio synthesis, run by scripts/audio.ts in Node. Everything is driven by the
// episode's bang list. Slowed bangs become thumps. At real speed one short pulse per bang
// turns the firing rate into a literal audible tone.
import type { Bang } from "./engine/fourStroke";
import { smoothstep } from "./math";

export const SAMPLE_RATE = 48000;
const SR = SAMPLE_RATE;

export type Rng = () => number;

/** Seeded generator (mulberry32). Output depends on call order, so keep the synthesis order fixed. */
export const createRng = (initial: number): Rng => {
  let seed = initial;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** `pulsePan` 0 = left, 1 = right. Leave it out to send real-speed pulses equally to both channels. */
export type BankVoice = { thumpHz: number; pan: number; pulseGain: number; pulsePan?: number };

export type ThumpSettings = {
  lengthS: number;
  sweepHz: number;
  sweepTau: number;
  bodyAmp: number;
  bodyTau: number;
  clickAmp: number;
  clickTau: number;
  snapAmp: number;
  snapHz: number;
  snapTau: number;
};

export type PulseSettings = {
  lengthS: number;
  decayTau: number;
  decayLevel: number;
  ringLevel: number;
  ringHz: number;
  noiseAmp: number;
  noiseTau: number;
  jitterMin: number;
  jitterRange: number;
};

export type ToneShaping = { dcCoef: number; lowpassHz: number; drive: number };

export type MusicBed = {
  barS: number;
  stepS: number;
  stepDecay: number;
  bassAmp: number;
  /** Bass root of each bar, Hz. */
  bass: number[];
  /** Pad chord of each bar, Hz. */
  chords: number[][];
  padAmp: number;
  detunedAmp: number;
  detune: number;
  rightGain: number;
};

export type Whoosh = { at: number; rising: boolean };

export type MixSettings = {
  bedGainSlowed: number;
  bedGainReal: number;
  pulseGain: number;
  thumpGain: number;
  fadeInS: number;
  fadeOutS: number;
  masterDrive: number;
  targetPeak: number;
};

export type EngineAudioSettings = {
  seed: number;
  voiceOf: (cyl: number) => BankVoice;
  thump: ThumpSettings;
  pulse: PulseSettings;
  shaping: ToneShaping;
  /** Simple looping backing. Leave out when the episode supplies a `song`. */
  bed?: MusicBed;
  whooshes: Whoosh[];
  mix: MixSettings;
};

/** A full stereo music track, plus an optional per-sample gain for the real-speed engine tone. */
export type SongTrack = { L: Float32Array; R: Float32Array; engineGain?: Float32Array };

/** Starting point for an episode: spread this, then set voiceOf and whooshes. */
export const defaultEngineAudio: Omit<EngineAudioSettings, "voiceOf" | "whooshes"> = {
  seed: 1234567,
  thump: {
    lengthS: 0.26,
    sweepHz: 60,
    sweepTau: 0.012,
    bodyAmp: 0.75,
    bodyTau: 0.055,
    clickAmp: 0.45,
    clickTau: 0.005,
    snapAmp: 0.18,
    snapHz: 2100,
    snapTau: 0.004,
  },
  pulse: {
    lengthS: 0.006,
    decayTau: 0.0007,
    decayLevel: 0.55,
    ringLevel: 0.45,
    ringHz: 1500,
    noiseAmp: 0.12,
    noiseTau: 0.002,
    jitterMin: 0.9,
    jitterRange: 0.2,
  },
  shaping: { dcCoef: 0.0015, lowpassHz: 4200, drive: 1.6 },
  // A minor, 120 BPM: A2 F2 C3 G2, one 2-second bar each.
  bed: {
    barS: 2,
    stepS: 0.25,
    stepDecay: 4,
    bassAmp: 0.5,
    bass: [110.0, 87.31, 130.81, 98.0],
    chords: [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
    ],
    padAmp: 0.06,
    detunedAmp: 0.04,
    detune: 1.003,
    rightGain: 0.96,
  },
  mix: {
    bedGainSlowed: 0.32,
    bedGainReal: 0.16,
    pulseGain: 0.55,
    thumpGain: 0.8,
    fadeInS: 0.08,
    fadeOutS: 0.6,
    masterDrive: 0.9,
    targetPeak: 0.72, // headroom so AAC encoding can't clip
  },
};

export type EngineAudioInput = {
  durationS: number;
  bangs: Bang[];
  isSlowed: (t: number) => boolean;
  settings: EngineAudioSettings;
  /** Builds the song. It receives the same seeded generator as the engine synthesis. */
  song?: (sampleCount: number, rnd: Rng) => SongTrack;
};

const addThumps = (bangs: Bang[], s: EngineAudioSettings, rnd: Rng, L: Float32Array, R: Float32Array) => {
  const N = L.length;
  const th = s.thump;
  for (const b of bangs) {
    const voice = s.voiceOf(b.cyl);
    const i0 = Math.round(b.t * SR);
    const len = Math.round(th.lengthS * SR);
    let phase = 0;
    for (let k = 0; k < len && i0 + k < N; k++) {
      const tau = k / SR;
      const f = voice.thumpHz + th.sweepHz * Math.exp(-tau / th.sweepTau);
      phase += (2 * Math.PI * f) / SR;
      const body = th.bodyAmp * Math.sin(phase) * Math.exp(-tau / th.bodyTau);
      const click = (rnd() * 2 - 1) * th.clickAmp * Math.exp(-tau / th.clickTau);
      const snap = th.snapAmp * Math.sin(2 * Math.PI * th.snapHz * tau) * Math.exp(-tau / th.snapTau);
      const v = body + click + snap;
      L[i0 + k] += v * (1 - voice.pan) * 2;
      R[i0 + k] += v * voice.pan * 2;
    }
  }
};

const addPulses = (bangs: Bang[], s: EngineAudioSettings, rnd: Rng, L: Float32Array, R: Float32Array) => {
  const N = L.length;
  const p = s.pulse;
  for (const b of bangs) {
    const i0 = Math.round(b.t * SR);
    const voice = s.voiceOf(b.cyl);
    const gain = voice.pulseGain;
    const gainL = voice.pulsePan === undefined ? 1 : (1 - voice.pulsePan) * 2;
    const gainR = voice.pulsePan === undefined ? 1 : voice.pulsePan * 2;
    const len = Math.round(p.lengthS * SR);
    const jitter = p.jitterMin + p.jitterRange * rnd();
    for (let k = 0; k < len && i0 + k < N; k++) {
      const tau = k / SR;
      const v =
        Math.exp(-tau / p.decayTau) * (p.decayLevel + p.ringLevel * Math.sin(2 * Math.PI * p.ringHz * tau)) +
        (rnd() * 2 - 1) * p.noiseAmp * Math.exp(-tau / p.noiseTau);
      L[i0 + k] += v * gain * jitter * gainL;
      R[i0 + k] += v * gain * jitter * gainR;
    }
  }
};

/** Removes DC, tames the top end, then saturates. */
const shapeTone = (buf: Float32Array, s: ToneShaping) => {
  let lp = 0;
  let dc = 0;
  const a = 1 - Math.exp((-2 * Math.PI * s.lowpassHz) / SR);
  for (let i = 0; i < buf.length; i++) {
    dc += (buf[i] - dc) * s.dcCoef;
    lp += (buf[i] - dc - lp) * a;
    buf[i] = Math.tanh(lp * s.drive);
  }
};

const renderBed = (b: MusicBed, L: Float32Array, R: Float32Array) => {
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const bar = Math.floor(t / b.barS) % b.bass.length;
    const step = (t % b.stepS) / b.stepS;
    const f = b.bass[bar];
    const env = Math.exp(-step * b.stepDecay);
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
    const bass = tri * env * b.bassAmp;
    let pad = 0;
    for (const ft of b.chords[bar]) pad += Math.sin(2 * Math.PI * ft * t) * b.padAmp + Math.sin(2 * Math.PI * ft * b.detune * t) * b.detunedAmp;
    const v = bass + pad;
    L[i] = v;
    R[i] = v * b.rightGain;
  }
};

const addWhoosh = ({ at, rising }: Whoosh, rnd: Rng, L: Float32Array, R: Float32Array) => {
  const len = Math.round(0.6 * SR);
  const i0 = Math.round((at - 0.35) * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const u = k / len;
    const fc = rising ? 300 + 5000 * u : 5300 - 5000 * u;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    lp += (rnd() * 2 - 1 - lp) * a;
    const env = Math.sin(Math.PI * u) ** 2;
    const i = i0 + k;
    if (i >= 0 && i < L.length) {
      L[i] += lp * env * 0.5;
      R[i] += lp * env * 0.5;
    }
  }
};

export type StereoAudio = { L: Float32Array; R: Float32Array; norm: number; summary: string };

export const renderEngineAudio = ({ durationS, bangs, isSlowed, settings, song }: EngineAudioInput): StereoAudio => {
  const N = Math.ceil(durationS * SR);
  const rnd = createRng(settings.seed);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const thumpL = new Float32Array(N);
  const thumpR = new Float32Array(N);
  const pulsesL = new Float32Array(N);
  const pulsesR = new Float32Array(N);
  const bedL = new Float32Array(N);
  const bedR = new Float32Array(N);

  addThumps(bangs.filter((b) => isSlowed(b.t)), settings, rnd, thumpL, thumpR);
  addPulses(bangs.filter((b) => !isSlowed(b.t)), settings, rnd, pulsesL, pulsesR);
  shapeTone(pulsesL, settings.shaping);
  shapeTone(pulsesR, settings.shaping);
  if (settings.bed) renderBed(settings.bed, bedL, bedR);
  for (const w of settings.whooshes) addWhoosh(w, rnd, L, R);
  const track = song?.(N, rnd);

  const m = settings.mix;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const bedGain = isSlowed(t) ? m.bedGainSlowed : m.bedGainReal;
    const fadeIn = smoothstep(t / m.fadeInS);
    const fadeOut = 1 - smoothstep((t - (durationS - m.fadeOutS)) / m.fadeOutS);
    const engine = m.pulseGain * (track?.engineGain?.[i] ?? 1);
    const l = L[i] + thumpL[i] * m.thumpGain + pulsesL[i] * engine + bedL[i] * bedGain + (track?.L[i] ?? 0);
    const r = R[i] + thumpR[i] * m.thumpGain + pulsesR[i] * engine + bedR[i] * bedGain + (track?.R[i] ?? 0);
    L[i] = Math.tanh(l * m.masterDrive) * fadeIn * fadeOut;
    R[i] = Math.tanh(r * m.masterDrive) * fadeIn * fadeOut;
  }
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = m.targetPeak / peak;
  const slowed = bangs.filter((b) => isSlowed(b.t)).length;
  return { L, R, norm, summary: `${durationS}s, ${bangs.length} bangs (${slowed} slowed), peak norm ${norm.toFixed(2)}` };
};

/** 16-bit stereo PCM WAV. */
export const encodeWav = ({ L, R, norm }: StereoAudio): Buffer => {
  const N = L.length;
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
  return buf;
};

export type EpisodeAudio = { render: () => StereoAudio };
