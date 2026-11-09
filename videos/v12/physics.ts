// Single source of truth for this video: scene, HUD, labels, captions and audio all read from here.
//
// Engine: Lamborghini L539, 6.5 L 60° V12 (generic body on screen, no badges).
// Sources:
//   Bore 95 mm, stroke 76.4 mm, 6,498 cc, 60° bank angle:
//     https://en.wikipedia.org/wiki/Lamborghini_Aventador
//     https://www.ultimatecarpage.com/spec/7338/Lamborghini-Aventador-SVJ.html
//   8,700 rpm maximum engine speed (Aventador SVJ variant, reported spec, not confirmed in factory text):
//     https://openers.jp/en/car/car_news/1662796
//     https://www.autoexpress.co.uk/lamborghini/aventador/104421/new-lamborghini-aventador-svj-blasts-in-at-pebble-beach-with-759bhp
//   Firing order 1-12-4-9-2-11-6-7-3-10-5-8 (Aventador L539; earlier Lamborghini V12s used a different order):
//     http://www.kfz-tech.de/Engl/Buchprojekte/Lamborghini/LamborghiniV121.htm
//     https://en.wikipedia.org/wiki/Lamborghini_Aventador (table row is uncited)
//     Secondary sources only; no factory workshop manual was found. Which physical bank is
//     1-6 is likewise unconfirmed for this engine, and the labels assume right = 1-6.

import { createFourStroke } from "../../src/kits/engine/fourStroke";
import type { ToneCheck } from "../../src/core/video";
import { ramp } from "../../src/core/math";
import { listFact, numberFact } from "../../src/core/spec";
import { meta, spec } from "./meta";

// Inputs come from the facts in spec.json. Everything else in this file is computed from them.
export const BORE_MM = numberFact(spec, "boreMm");
export const STROKE_MM = numberFact(spec, "strokeMm");
export const BANK_ANGLE_DEG = numberFact(spec, "bankAngleDeg");
export const REDLINE = numberFact(spec, "redlineRpm");
export const CAMSHAFTS = numberFact(spec, "camshafts");
export const VALVES_PER_CYLINDER = numberFact(spec, "valvesPerCylinder");

/** Tachometer scale on the HUD. */
export const TACH_MAX = 9000;
export const TACH_RED_FROM = 8000;

// Cylinders 1-6 = right bank, 7-12 = left bank.
export const FIRING_ORDER = listFact(spec, "firingOrder");
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

// ---- the beat ----
// The song's tempo is chosen so the engine lands on it exactly: at redline, slowed, the firing
// rate is 32nd notes at this BPM. Each halving of RPM then moves up one note value, so 16ths,
// 8ths and quarter notes are literally the engine at 1/2, 1/4 and 1/8 of redline.
export const { bpm: BPM, beatsPerBar: BEATS_PER_BAR, bars: BARS } = spec.song;
/** On-screen time of a beat. Written as a single division so grid times match the crank table exactly. */
export const beatT = (beat: number) => (beat * 60) / BPM;
export const barT = (bar: number) => beatT(bar * BEATS_PER_BAR);

const REDLINE_BANGS = (REDLINE / 60) * (CYLINDERS / 2);
export const SLOW = REDLINE_BANGS / ((BPM / 60) * 8);
export const IDLE = REDLINE / 8;

export const SLOW_START = barT(2);
export const REAL_SPEED_START = barT(14);
export const DROP = barT(16);

export const isSlowed = (t: number) => t >= SLOW_START && t < REAL_SPEED_START;
export const slowAt = (t: number) => (isSlowed(t) ? SLOW : 1);

export const rpmAt = (t: number): number => {
  if (t < SLOW_START) return REDLINE;
  if (t < barT(8)) return IDLE;
  if (t < barT(10)) return IDLE * 2;
  if (t < barT(12)) return IDLE * 4;
  if (t < REAL_SPEED_START) return REDLINE;
  // Back at real speed the engine climbs in octaves on the beat, then opens up into the drop.
  if (t < beatT(58)) return IDLE;
  if (t < beatT(60)) return IDLE * 2;
  if (t < beatT(62)) return IDLE * 4;
  if (t < DROP) return ramp(t, beatT(62), DROP, IDLE * 4, REDLINE);
  if (t < barT(19)) return REDLINE;
  return ramp(t, barT(19), beatT(79), REDLINE, IDLE);
};

// Cylinder 1 fires exactly on this downbeat, which puts every slowed bang on the grid.
export const BANG_BEAT = barT(5);

export const engine = createFourStroke({
  firingOrder: FIRING_ORDER,
  durationS: meta.durationS,
  rpmAt,
  slowAt,
  phaseLockT: BANG_BEAT,
});

export const { crankAt, cycleAt, bangs: BANGS, firstBangAfter, bangsPerSecond } = engine;

/** Valve open windows in cycle degrees. Schematic, not measured L539 cam timing; label them that way on screen. */
export const EXHAUST_VALVE = { open: 150, close: 390, peak: 270 };
export const INTAKE_VALVE = { open: 330, close: 590, peak: 460 };

/** The engine's redline note. The song is tuned so this is exactly its tonic, A. */
export const ENGINE_NOTE_HZ = bangsPerSecond(REDLINE);
/** A4 for the song: one octave below the engine's redline note. */
export const SONG_A4_HZ = ENGINE_NOTE_HZ / 2;

/**
 * Sections held at redline at real speed, clear of rev ramps and whooshes. The search band sits
 * above the song's bass, chords and lead, so the check measures the engine and not the music.
 */
const ENGINE_BAND = { minHz: 780, maxHz: 2000 };
export const toneChecks: ToneCheck[] = [
  { label: "opening", from: 0.06, to: 1.5, expectedHz: ENGINE_NOTE_HZ, ...ENGINE_BAND },
  { label: "finale", from: 25.7, to: 30.3, expectedHz: ENGINE_NOTE_HZ, ...ENGINE_BAND },
];
