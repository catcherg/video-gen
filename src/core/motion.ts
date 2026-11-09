// Motion as pure functions of time. No state, no deltas: any frame can be computed on its own.
import { clamp01, hash, smoothstep } from "./math";

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const easeOutCubic = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const easeInCubic = (u: number) => clamp01(u) ** 3;

/** Overshoots slightly, then settles. */
export const easeOutBack = (u: number) => {
  const c = clamp01(u) - 1;
  return 1 + 2.7 * c * c * c + 1.7 * c * c;
};

/** 0 before `from`, 1 after `to`. */
export const progress = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

/** 1 inside a window, easing in and out over `edge` seconds at each end. */
export const fadeWindow = (t: number, from: number, to: number, edge = 0.15) => Math.min(smoothstep((t - from) / edge), smoothstep((to - t) / edge));

/** Scale for an element that pops in at a moment. */
export const popIn = (t: number, at: number, duration = 0.25) => (t < at ? 0 : easeOutBack((t - at) / duration));

/** How far item i of n has appeared, for an overall progress of 0 to 1. `spread` is the share of time spent starting items. */
export const staggered = (p: number, i: number, n: number, spread = 0.6) => {
  const start = n > 1 ? (i / (n - 1)) * spread : 0;
  return clamp01((p - start) / (1 - spread));
};

/** A decaying punch, 1 on the most recent hit at or before t. Hits must be sorted. Use it for anything that lands on a beat. */
export const hitPulse = (t: number, hits: number[], decayS = 0.18) => {
  let last = -1;
  for (const hit of hits) {
    if (hit > t) break;
    last = hit;
  }
  return last < 0 ? 0 : Math.exp(-(t - last) / decayS);
};

/** A closed-form damped spring from 0 to 1, released at a moment. `hz` is how fast it rings, `damping` how quickly it stops. */
export const spring = (t: number, at: number, hz = 2.5, damping = 6) => {
  if (t <= at) return 0;
  const s = t - at;
  return 1 - Math.exp(-damping * s) * Math.cos(2 * Math.PI * hz * s);
};

export type Key = { t: number; v: number };

/** Value on an eased track of keys, sorted by time. Holds outside the first and last key. */
export const track = (t: number, keys: Key[]) => {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) return lerp(keys[i - 1].v, keys[i].v, smoothstep((t - keys[i - 1].t) / (keys[i].t - keys[i - 1].t)));
  }
  return keys[keys.length - 1].v;
};

/** Smooth repeatable noise in -1..1 for one seed. */
export const noise = (t: number, seed: number) => {
  const i = Math.floor(t);
  return lerp(hash(i, seed), hash(i + 1, seed), smoothstep(t - i)) * 2 - 1;
};

/** Screen or camera shake that decays after a hit. Returns an offset for one axis; use a different seed per axis. */
export const shake = (t: number, hits: number[], amount: number, seed: number, hz = 18, decayS = 0.18) => hitPulse(t, hits, decayS) * amount * noise(t * hz, seed);

/** How many characters of a line are showing. */
export const typedChars = (text: string, t: number, at: number, charsPerS = 42) => Math.max(0, Math.min(text.length, Math.floor((t - at) * charsPerS)));

/** A number counting up between two moments. */
export const countUp = (t: number, from: number, to: number, a: number, b: number) => lerp(a, b, smoothstep((t - from) / (to - from)));

/** Rounds to a pixel grid, so motion and sizes stay blocky. */
export const snap = (v: number, step = 4) => Math.round(v / step) * step;
