// Single source of truth for the engine: RPM over time, slow-motion factor,
// crank angle, firing order and every "bang". The 3D scene, the HUD and the
// audio script all read from here, so their numbers can never disagree.

export const FPS = 30;
export const DURATION_S = 32;
export const DURATION_FRAMES = FPS * DURATION_S;

export const SLOW = 40; // slow-motion factor used in the explainer section

// Lamborghini 6.5 L 60° V12 (L539): bore 95 mm, stroke 76.4 mm
export const BORE_MM = 95;
export const STROKE_MM = 76.4;
export const REDLINE = 8700;

// Firing order, cylinders 1-6 = right bank, 7-12 = left bank.
export const FIRING_ORDER = [1, 7, 4, 10, 2, 8, 6, 12, 3, 9, 5, 11];
// Crank angle (0-720) at which each cylinder fires (index = cylinder number).
export const FIRE_OFFSET: number[] = (() => {
  const o: number[] = new Array(13).fill(0);
  FIRING_ORDER.forEach((cyl, i) => (o[cyl] = i * 60));
  return o;
})();

const smooth = (x: number) => x * x * (3 - 2 * x);
const ramp = (t: number, t0: number, t1: number, a: number, b: number) =>
  a + (b - a) * smooth(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));

// [start time, slow factor, rpm function]
export const REAL_SPEED_START = 22.5;
export const SLOW_START = 3.0;

export const isSlowed = (t: number) => t >= SLOW_START && t < REAL_SPEED_START;
export const slowAt = (t: number) => (isSlowed(t) ? SLOW : 1);

export const rpmAt = (t: number): number => {
  if (t < SLOW_START) return ramp(t, 0, 0.7, 6500, 8700);
  if (t < 11.5) return 1100;
  if (t < 15.8) return ramp(t, 11.5, 12.3, 1100, 2200);
  if (t < 19.6) return ramp(t, 15.8, 16.6, 2200, 4400);
  if (t < REAL_SPEED_START) return ramp(t, 19.6, 20.6, 4400, 8700);
  if (t < 30.6) return ramp(t, 23.0, 24.8, 1100, 8700);
  return ramp(t, 30.6, 31.6, 8700, 1600);
};

// Bangs per second at real speed: a 4-stroke V12 fires 6 times per crank revolution.
export const bangsPerSecond = (rpm: number) => (rpm / 60) * 6;

// ---- crank angle table (on-screen time, includes slow motion) ----
const TABLE_HZ = 2400;
const N = DURATION_S * TABLE_HZ + 2;
const raw = new Float64Array(N);
{
  let a = 0;
  for (let i = 0; i < N; i++) {
    raw[i] = a;
    const t = i / TABLE_HZ;
    a += (360 * rpmAt(t)) / 60 / slowAt(t) / TABLE_HZ;
  }
}
const rawAt = (t: number) => {
  const x = Math.min(N - 1.0001, Math.max(0, t * TABLE_HZ));
  const i = Math.floor(x);
  return raw[i] + (raw[i + 1] - raw[i]) * (x - i);
};
// Phase chosen so cylinder 1 fires exactly at t = 8.0 s (the "only one is a bang" beat).
const BANG_BEAT = 8.0;
const OFFSET = (720 - (rawAt(BANG_BEAT) % 720)) % 720;

/** Crank angle in degrees at on-screen time t. */
export const crankAt = (t: number) => rawAt(t) + OFFSET;

/** Where cylinder `cyl` is in its 720° cycle: 0 = firing (top of power stroke). */
export const cycleAt = (cyl: number, t: number) => {
  const c = (crankAt(t) - FIRE_OFFSET[cyl]) % 720;
  return c < 0 ? c + 720 : c;
};

export const strokeName = (c: number) =>
  c < 180 ? "BANG" : c < 360 ? "EXHAUST" : c < 540 ? "INTAKE" : "SQUEEZE";

/** All firing events (on-screen seconds + cylinder) across the video. */
export type Bang = { t: number; cyl: number };
export const BANGS: Bang[] = (() => {
  const out: Bang[] = [];
  for (let i = 0; i < N - 1; i++) {
    const a0 = raw[i] + OFFSET;
    const a1 = raw[i + 1] + OFFSET;
    let k = Math.floor(a0 / 60) + 1;
    while (k * 60 <= a1) {
      const frac = (k * 60 - a0) / (a1 - a0);
      const slot = ((k % 12) + 12) % 12;
      out.push({ t: (i + frac) / TABLE_HZ, cyl: FIRING_ORDER[slot] });
      k++;
    }
  }
  return out;
})();

/** Index of the first bang at or after time t (binary search). */
export const firstBangAfter = (t: number) => {
  let lo = 0;
  let hi = BANGS.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (BANGS[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** Mean piston speed in m/s. */
export const meanPistonSpeed = (rpm: number) => (2 * (STROKE_MM / 1000) * rpm) / 60;
