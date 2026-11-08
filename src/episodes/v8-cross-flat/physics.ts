// Single source of truth for this episode: scene, HUD, labels, captions and audio all read from here.
//
// Two real engines, shown as generic V8s (no badges or brand names on screen):
//
// Cross-plane: GM LS3, 6.2 L, 90° V8.
//   Bore 103.25 mm, stroke 92 mm, firing order 1-8-7-2-6-5-4-3:
//     https://gmauthority.com/blog/gm/gm-engines/ls3/
//     https://gmspecialtyvehicles.com/chevrolet-performance/powertrain/engines/ls3
//   Cylinder numbering, odd on the driver's side and even on the passenger's side:
//     https://www.holley.com/blog/post/gen_iii_gen_iv_ls_engine_specs_dimensions_and_engine_history/
//   Per-bank firing gaps of 180-90-180-270 degrees: https://en.wikipedia.org/wiki/Crossplane
//
// Flat-plane: Ferrari F136 (458), 4497 cc, 90° V8.
//   Bore 94 mm, stroke 81 mm: https://www.whichcar.com.au/features/great-v8s-ferrari-f136
//   Firing order 1-5-3-7-4-8-2-6 is from enthusiast forums only, no factory manual was found:
//     https://www.corvetteforum.com/forums/c8-z06-discussion/4611352-c8-z06-firing-order.html
//     https://www.homemodelenginemachinist.com/threads/flat-plane-crank-firing-order.25168/
//   Banks alternating right-left: https://en.wikipedia.org/wiki/Flat-plane_crank
//   Numbering 1-4 on one bank and 5-8 on the other is assumed from that order; which side is right is unconfirmed.
//
// Both are shown at the same RPM so only the crank differs. 6,000 rpm is within both redlines.

import { createFourStroke, dominantPulseHz } from "../../core/engine/fourStroke";
import type { ToneCheck } from "../../core/episode";
import { meta } from "./meta";

export const BANK_ANGLE_DEG = 90;
export const SHOW_RPM = 6000;
export const SLOW_RPM = 1500;
export const TACH_MAX = 7000;
export const TACH_RED_FROM = 6500;

export const SLOW = 40;
export const SWAP_TO_FLAT_HOOK = 3;
export const SLOW_START = 6;
export const FLAT_SLOW_START = 12.5;
export const REAL_SPEED_START = 19;
export const FLAT_REAL_START = 24.5;

export const isSlowed = (t: number) => t >= SLOW_START && t < REAL_SPEED_START;
export const slowAt = (t: number) => (isSlowed(t) ? SLOW : 1);
export const rpmAt = (t: number) => (isSlowed(t) ? SLOW_RPM : SHOW_RPM);

type V8Spec = {
  label: string;
  boreMm: number;
  strokeMm: number;
  firingOrder: number[];
  isRight: (cyl: number) => boolean;
  /** Position along the crank, 0 at the front. */
  row: (cyl: number) => number;
  /** Cylinders sharing each crank pin. */
  pins: [number, number][];
  phaseLockT: number;
};

const makeV8 = (spec: V8Spec) => ({
  ...spec,
  engine: createFourStroke({ firingOrder: spec.firingOrder, durationS: meta.durationS, rpmAt, slowAt, phaseLockT: spec.phaseLockT }),
});
export type V8 = ReturnType<typeof makeV8>;

export const CROSS = makeV8({
  label: "CROSS-PLANE",
  boreMm: 103.25,
  strokeMm: 92,
  firingOrder: [1, 8, 7, 2, 6, 5, 4, 3],
  isRight: (cyl) => cyl % 2 === 0,
  row: (cyl) => Math.floor((cyl - 1) / 2),
  pins: [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
  ],
  phaseLockT: 8,
});

export const FLAT = makeV8({
  label: "FLAT-PLANE",
  boreMm: 94,
  strokeMm: 81,
  firingOrder: [1, 5, 3, 7, 4, 8, 2, 6],
  isRight: (cyl) => cyl <= 4,
  row: (cyl) => (cyl <= 4 ? cyl - 1 : cyl - 5),
  pins: [
    [1, 5],
    [2, 6],
    [3, 7],
    [4, 8],
  ],
  phaseLockT: 14.5,
});

/** Which engine is on screen at time t. */
export const engineAt = (t: number): V8 => {
  if (t < SWAP_TO_FLAT_HOOK) return CROSS;
  if (t < SLOW_START) return FLAT;
  if (t < FLAT_SLOW_START) return CROSS;
  if (t < REAL_SPEED_START) return FLAT;
  return t < FLAT_REAL_START ? CROSS : FLAT;
};

export const bankDeg = (v8: V8, cyl: number) => (v8.isRight(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2);

const mod360 = (x: number) => ((x % 360) + 360) % 360;

/** Crank angles at which one bank fires, ascending. */
export const bankFiringAngles = (v8: V8, right: boolean) =>
  v8.firingOrder
    .filter((cyl) => v8.isRight(cyl) === right)
    .map((cyl) => v8.engine.fireOffset[cyl])
    .sort((a, b) => a - b);

/** Crank degrees between one bank's consecutive firings, starting from its first. */
export const bankGapsDeg = (v8: V8, right: boolean) => {
  const a = bankFiringAngles(v8, right);
  return a.map((angle, i) => (i + 1 < a.length ? a[i + 1] - angle : a[0] + 720 - angle));
};

/** Pin angles about the crank axis, degrees, in crank order. */
export const pinAnglesDeg = (v8: V8) => v8.pins.map(([a]) => mod360(bankDeg(v8, a) - v8.engine.fireOffset[a]));

/** Smallest angle between any two crank pins that are not in line. */
export const pinSpacingDeg = (v8: V8) => {
  const angles = [...new Set(pinAnglesDeg(v8))].sort((a, b) => a - b);
  return Math.min(...angles.map((a, i) => (i + 1 < angles.length ? angles[i + 1] - a : angles[0] + 360 - a)));
};

export const bangsPerSecond = (rpm: number) => CROSS.engine.bangsPerSecond(rpm);

/** Decay of one exhaust pulse in the audio model. */
export const PULSE_TAU_S = 0.0007;

/** Loudest frequency one bank's exhaust produces at the given RPM. */
export const bankToneHz = (v8: V8, right: boolean, rpm: number) => dominantPulseHz(bankFiringAngles(v8, right), rpm, PULSE_TAU_S);

const checks = (label: string, v8: V8, from: number, to: number): ToneCheck[] => [
  { label, from, to, channel: "left", expectedHz: bankToneHz(v8, false, SHOW_RPM) },
  { label, from, to, channel: "right", expectedHz: bankToneHz(v8, true, SHOW_RPM) },
];

/** Each bank is panned hard to its own side, so each channel carries one bank's pulse pattern. */
export const crossToneChecks = [...checks("cross hook", CROSS, 0.4, 2.6), ...checks("cross finale", CROSS, 19.5, 24.2)];
export const flatToneChecks = [...checks("flat hook", FLAT, 3.3, 5.4), ...checks("flat finale", FLAT, 24.8, 29.2)];
export const toneChecks: ToneCheck[] = [...crossToneChecks, ...flatToneChecks];
