// Measures when a hit in a finished WAV can actually be heard.
const WINDOW_S = 0.005;
const SCAN_S = 0.12;
/** A hit counts as audible once it is within this many dB of its own peak. */
const AUDIBLE_DB = 6;

/** Returns a function giving the seconds from a scheduled hit until the sound reaches its audible level. */
export const makeAudibleDelay = (wav: Buffer) => {
  const sampleRate = wav.readUInt32LE(24);
  const frames = (wav.length - 44) / 4;
  const mono = (i: number) => (wav.readInt16LE(44 + i * 4) + wav.readInt16LE(46 + i * 4)) / 65536;
  const rmsAt = (t: number) => {
    const from = Math.round(t * sampleRate);
    const n = Math.round(WINDOW_S * sampleRate);
    let sum = 0;
    for (let i = from; i < Math.min(frames, from + n); i++) sum += mono(i) ** 2;
    return Math.sqrt(sum / n);
  };
  return (t: number) => {
    const STEP = 0.001;
    const levels: number[] = [];
    for (let d = 0; d < SCAN_S; d += STEP) levels.push(rmsAt(t + d));
    const threshold = Math.max(...levels) * 10 ** (-AUDIBLE_DB / 20);
    return levels.findIndex((l) => l >= threshold) * STEP;
  };
};

const ENVELOPE_HOP_S = 0.002;

/** Short-time level of a WAV, for lining two versions of the same audio up against each other. */
const envelope = (wav: Buffer) => {
  const sampleRate = wav.readUInt32LE(24);
  const frames = Math.floor((wav.length - 44) / 4);
  const hop = Math.round(ENVELOPE_HOP_S * sampleRate);
  const out = new Float64Array(Math.floor(frames / hop));
  for (let h = 0; h < out.length; h++) {
    let sum = 0;
    for (let i = 0; i < hop; i++) sum += Math.abs(wav.readInt16LE(44 + (h * hop + i) * 4)) + Math.abs(wav.readInt16LE(46 + (h * hop + i) * 4));
    out[h] = sum / hop;
  }
  return out;
};

/** How late `b` runs against `a`, in seconds, found by sliding their levels past each other. */
export const audioLagS = (a: Buffer, b: Buffer, searchS = 0.12) => {
  const ea = envelope(a);
  const eb = envelope(b);
  const reach = Math.round(searchS / ENVELOPE_HOP_S);
  const n = Math.min(ea.length, eb.length) - 2 * reach;
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = -reach; lag <= reach; lag++) {
    let score = 0;
    for (let i = reach; i < n; i++) score += ea[i] * eb[i + lag];
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  return bestLag * ENVELOPE_HOP_S;
};
