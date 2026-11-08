// Single source of truth for this episode: scene, HUD, labels, captions and audio all read from here.
//
// Engine: Lamborghini L539, 6.5 L 60° V12 (generic body on screen, no badges).
// Sources:
//   Bore 95 mm, stroke 76.4 mm, 6,498 cc, 60° bank angle:
//     https://en.wikipedia.org/wiki/Lamborghini_Aventador
//     https://www.ultimatecarpage.com/spec/7338/Lamborghini-Aventador-SVJ.html
//   8,700 rpm maximum engine speed (Aventador SVJ variant, reported spec, not confirmed in factory text):
//     https://openers.jp/en/car/car_news/1662796
//     https://www.autoexpress.co.uk/lamborghini/aventador/104421/new-lamborghini-aventador-svj-blasts-in-at-pebble-beach-with-759bhp
//   Firing order: carried over unchanged from the proof of concept for now.

import { createFourStroke } from "../../core/engine/fourStroke";
import type { ToneCheck } from "../../core/episode";
import { ramp } from "../../core/math";
import { meta } from "./meta";

export const BORE_MM = 95;
export const STROKE_MM = 76.4;
export const BANK_ANGLE_DEG = 60;
export const REDLINE = 8700;
export const IDLE = 1100;
export const CAMSHAFTS = 4;
export const VALVES_PER_CYLINDER = 4;

/** Tachometer scale on the HUD. */
export const TACH_MAX = 9000;
export const TACH_RED_FROM = 8000;

// Cylinders 1-6 = right bank, 7-12 = left bank.
export const FIRING_ORDER = [1, 7, 4, 10, 2, 8, 6, 12, 3, 9, 5, 11];
export const CYLINDERS = FIRING_ORDER.length;
/** Each pin carries one rod from each bank. */
export const CRANK_PINS: [number, number][] = [
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
  [6, 12],
];
export const isRightBank = (cyl: number) => cyl <= 6;

export const SLOW = 40; // slow-motion factor in the explainer section
export const SLOW_START = 3.0;
export const REAL_SPEED_START = 22.5;

export const isSlowed = (t: number) => t >= SLOW_START && t < REAL_SPEED_START;
export const slowAt = (t: number) => (isSlowed(t) ? SLOW : 1);

export const rpmAt = (t: number): number => {
  if (t < SLOW_START) return ramp(t, 0, 0.7, 6500, REDLINE);
  if (t < 11.5) return IDLE;
  if (t < 15.8) return ramp(t, 11.5, 12.3, IDLE, 2200);
  if (t < 19.6) return ramp(t, 15.8, 16.6, 2200, 4400);
  if (t < REAL_SPEED_START) return ramp(t, 19.6, 20.6, 4400, REDLINE);
  if (t < 30.6) return ramp(t, 23.0, 24.8, IDLE, REDLINE);
  return ramp(t, 30.6, 31.6, REDLINE, 1600);
};

// Cylinder 1 fires exactly at the "only one is a bang" beat.
export const BANG_BEAT = 8.0;

export const engine = createFourStroke({
  firingOrder: FIRING_ORDER,
  durationS: meta.durationS,
  rpmAt,
  slowAt,
  phaseLockT: BANG_BEAT,
});

export const { crankAt, cycleAt, bangs: BANGS, firstBangAfter, bangsPerSecond } = engine;

/** Sections held at redline at real speed, clear of rev ramps and whooshes. */
export const toneChecks: ToneCheck[] = [
  { label: "opening", from: 0.8, to: 2.6, expectedHz: bangsPerSecond(REDLINE) },
  { label: "finale", from: 25.0, to: 30.4, expectedHz: bangsPerSecond(REDLINE) },
];
