// Measures a finished song: headroom, how bass-heavy it is, and whether its hits survive a phone speaker.
// Measurements can show a song is broken. Only a person can say that it is good.
import { fft } from "./fft";

export type SongReport = {
  peak: number;
  clipped: number;
  rmsDb: number;
  /** Share of total energy in each band, percent. */
  bands: { sub: number; lowMid: number; mid: number; high: number };
  /** Median jump in level at a hit, dB, heard through a simulated phone speaker. */
  phonePunchDb: number;
  /** Same measure with the full range of the song. */
  fullPunchDb: number;
  /** Median jump in level at the start of a drop, dB. */
  dropJumpDb: number;
};

const PHONE_HIGHPASS_HZ = 350;
const PUNCH_WINDOW_S = 0.04;
const DROP_WINDOW_S = 0.2;
const FFT_SIZE = 2 ** 15;

export const readWav = (wav: Buffer) => {
  const sampleRate = wav.readUInt32LE(24);
  const frames = (wav.length - 44) / 4;
  const mono = new Float64Array(frames);
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i < frames; i++) {
    const l = wav.readInt16LE(44 + i * 4);
    const r = wav.readInt16LE(46 + i * 4);
    mono[i] = (l + r) / 65536;
    const m = Math.max(Math.abs(l), Math.abs(r));
    peak = Math.max(peak, m / 32768);
    if (m >= 32767) clipped++;
  }
  return { sampleRate, mono, peak, clipped };
};

/** Two cascaded one-pole high-passes: small phone speakers reproduce very little below a few hundred Hz. */
export const phoneSpeaker = (x: Float64Array, sampleRate: number) => {
  const a = Math.exp((-2 * Math.PI * PHONE_HIGHPASS_HZ) / sampleRate);
  const out = new Float64Array(x.length);
  let prev1 = 0;
  let y1 = 0;
  let prev2 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    y1 = a * (y1 + x[i] - prev1);
    prev1 = x[i];
    y2 = a * (y2 + y1 - prev2);
    prev2 = y1;
    out[i] = y2;
  }
  return out;
};

const rms = (x: Float64Array, from: number, to: number) => {
  let sum = 0;
  const a = Math.max(0, from);
  const b = Math.min(x.length, to);
  for (let i = a; i < b; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / Math.max(1, b - a));
};

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
};

/** Median rise in level just after each hit compared with just before it. */
const punchDb = (x: Float64Array, sampleRate: number, hits: number[]) => {
  const span = Math.round(PUNCH_WINDOW_S * sampleRate);
  return median(
    hits.map((t) => {
      const i = Math.round(t * sampleRate);
      return 20 * Math.log10((rms(x, i, i + span) + 1e-6) / (rms(x, i - span, i) + 1e-6));
    }),
  );
};

const bandShares = (x: Float64Array, sampleRate: number) => {
  const totals = { sub: 0, lowMid: 0, mid: 0, high: 0 };
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let start = 0; start + FFT_SIZE <= x.length; start += FFT_SIZE) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = x[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < FFT_SIZE / 2; k++) {
      const f = (k * sampleRate) / FFT_SIZE;
      const power = re[k] * re[k] + im[k] * im[k];
      if (f < 120) totals.sub += power;
      else if (f < 400) totals.lowMid += power;
      else if (f < 2000) totals.mid += power;
      else totals.high += power;
    }
  }
  const sum = totals.sub + totals.lowMid + totals.mid + totals.high;
  const pct = (v: number) => (100 * v) / sum;
  return { sub: pct(totals.sub), lowMid: pct(totals.lowMid), mid: pct(totals.mid), high: pct(totals.high) };
};

/** How much louder the song gets at a drop, comparing the moment before it with the moment after. */
const dropJumpDb = (x: Float64Array, sampleRate: number, drops: number[]) => {
  const span = Math.round(DROP_WINDOW_S * sampleRate);
  return median(
    drops.map((t) => {
      const i = Math.round(t * sampleRate);
      return 20 * Math.log10((rms(x, i, i + span) + 1e-6) / (rms(x, i - span, i) + 1e-6));
    }),
  );
};

export const analyseSong = (wav: Buffer, hits: number[], drops: number[] = []): SongReport => {
  const { sampleRate, mono, peak, clipped } = readWav(wav);
  return {
    peak,
    clipped,
    rmsDb: 20 * Math.log10(rms(mono, 0, mono.length) + 1e-9),
    bands: bandShares(mono, sampleRate),
    phonePunchDb: punchDb(phoneSpeaker(mono, sampleRate), sampleRate, hits),
    fullPunchDb: punchDb(mono, sampleRate, hits),
    dropJumpDb: dropJumpDb(mono, sampleRate, drops),
  };
};

export const formatReport = (r: SongReport) =>
  `peak ${r.peak.toFixed(3)}, clipped ${r.clipped}, RMS ${r.rmsDb.toFixed(1)} dB | sub ${r.bands.sub.toFixed(0)}% low-mid ${r.bands.lowMid.toFixed(0)}% mid ${r.bands.mid.toFixed(0)}% high ${r.bands.high.toFixed(1)}% | punch ${r.fullPunchDb.toFixed(1)} dB, on a phone ${r.phonePunchDb.toFixed(1)} dB | drop jump ${r.dropJumpDb.toFixed(1)} dB`;

const MIN_BASS_SHARE = 80;
const MIN_PHONE_PUNCH_DB = 5;
const MIN_DROP_JUMP_DB = 6;

/** Reasons a song fails the basic bar. The approved F1 V8 track has 94% bass and jumps 7.1 dB on a phone. */
export const songProblems = (r: SongReport): string[] => {
  const problems: string[] = [];
  if (r.peak > 0.95) problems.push(`peak ${r.peak.toFixed(3)} leaves too little headroom for AAC encoding`);
  if (r.clipped > 0) problems.push(`${r.clipped} clipped samples`);
  if (r.bands.sub + r.bands.lowMid < MIN_BASS_SHARE) problems.push(`only ${(r.bands.sub + r.bands.lowMid).toFixed(0)}% of the energy is bass`);
  if (r.phonePunchDb < MIN_PHONE_PUNCH_DB) problems.push(`hits only jump ${r.phonePunchDb.toFixed(1)} dB on a phone speaker`);
  if (r.dropJumpDb < MIN_DROP_JUMP_DB) problems.push(`the drop only jumps ${r.dropJumpDb.toFixed(1)} dB`);
  return problems;
};
