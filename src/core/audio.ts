// Audio plumbing shared by every video: the sample rate, the seeded generator and WAV encoding.

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

export type StereoAudio = { L: Float32Array; R: Float32Array; norm: number; summary: string };

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
