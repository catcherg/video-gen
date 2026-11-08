export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Clamped cubic ease (0..1). */
export const smoothstep = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** Quintic ease, expects x already in 0..1. */
export const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/** Eased value going from a to b between times t0 and t1, held outside that range. */
export const ramp = (t: number, t0: number, t1: number, a: number, b: number) =>
  a + (b - a) * smoothstep((t - t0) / (t1 - t0));

export const D2R = Math.PI / 180;

/** Deterministic hash in [0,1). Use this instead of Math.random in anything visible. */
export const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** 8700 -> "8,700". Locale fixed so output never depends on the machine. */
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Nearest equal-tempered note to a frequency, with the offset from it in cents. */
export const noteName = (f: number) => {
  const m = Math.round(12 * Math.log2(f / 440) + 69);
  const cents = 1200 * Math.log2(f / (440 * 2 ** ((m - 69) / 12)));
  return { midi: m, name: NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1), cents };
};
