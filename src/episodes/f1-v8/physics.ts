// Single source of truth for this episode: scene, HUD, labels, captions and audio all read from here.
//
// Engine: Honda RA808E, 2008 Formula One 2.4 L 90° V8 (generic body on screen, no badges).
// Primary sources, Honda R&D Technical Review 2009, F1 Special (The Third Era Activities):
//   [S] Sakurahara, "Summary of Honda Formula One Engine in Third-Era Activities", pp. 14-18
//   [D] Kondo et al., "Explanation of Honda's Third Era Formula One Engine Development", pp. 38-43
//   [E] Kondo et al., "Technical Description of Formula One Engine Structural Design", pp. 44-53
//   [V] Hayakawa et al., "Development of Valvetrain for Formula One Engine", pp. 64-71
//
//   90° V8, 2.4 L, 97 mm bore, 106.35 mm bore pitch, 490 mm long, 95.1 kg, 58.5 mm crank height: [E] Table 1
//   19,000 rpm upshift speed and regulation limit from 2007: [V] Table 1, [S] Table 1
//   20,300 rpm valvetrain limit, intake lift 13.5 mm, exhaust 13.0 mm, valves 41.6/32.4 mm,
//     "19/64" valve timing, 570 cm³ carbon air bottle, gear drive: [V] Table 1
//   Valve acceleration over 6000 G: [V] section 3.2.2
//   Finger followers from 2002, air springs prevent metal-spring surge: [V] sections 2, 3.2.1
//   230 g piston (A2618, from 2006): [D] section 2.1.2. Compression ratio 13.0: [D] section 2.1.3
//   Engine bolted between monocoque and gearbox as part of the frame: [E] section 1
//
// Weaker figures:
//   Stroke 40.52 mm is NOT in the papers. Single secondary source (grandprixengines.co.uk Note 121,
//     https://www.grandprixengines.co.uk/Note_121.pdf). It agrees with the 2.4 L class: 97 mm × 40.52 mm × 8 = 2,395.6 cc.
//   Crank type and firing order are NOT in the papers, and no published Honda figure was found.
//     Flat-plane with order 1-5-3-7-4-8-2-6 is the standard layout for a 90° racing V8. It is self-consistent
//     (see the crank-pin test) but is an assumption for this engine, so the diagram is labelled TYPICAL on screen.
//   Valve timing "19/64" is read as intake opens 19° BTDC and closes 64° ABDC, with the exhaust mirrored
//     (opens 64° BBDC, closes 19° ATDC). The table gives no reference lift and no reading convention.

import { createFourStroke } from "../../core/engine/fourStroke";
import type { ToneCheck } from "../../core/episode";
import { ramp } from "../../core/math";
import { meta } from "./meta";

export const BORE_MM = 97;
export const STROKE_MM = 40.52;
export const BANK_ANGLE_DEG = 90;
export const REDLINE = 19000;
export const VALVETRAIN_LIMIT_RPM = 20300;
export const COMPRESSION_RATIO = 13.0;
export const PISTON_G = 230;
export const BORE_PITCH_MM = 106.35;
export const ENGINE_LENGTH_MM = 490;
export const ENGINE_MASS_KG = 95.1;
export const CRANK_HEIGHT_MM = 58.5;
export const INTAKE_VALVE_MM = 41.6;
export const EXHAUST_VALVE_MM = 32.4;
export const INTAKE_LIFT_MM = 13.5;
export const EXHAUST_LIFT_MM = 13.0;
export const VALVE_ACCEL_G = 6000;
export const AIR_BOTTLE_CC = 570;
export const CAMSHAFTS = 4;
export const VALVES_PER_CYLINDER = 4;
/** Lowest slowed speed. The papers put idling at 5500 rpm and below ([V] section 4.2.3). */
export const IDLE_RANGE_MAX_RPM = 5500;

/** Tachometer scale on the HUD. */
export const TACH_MAX = 21000;
export const TACH_RED_FROM = 18000;

// Cylinders 1-4 = bank A, 5-8 = bank B. Assumed flat-plane order, see the header comment.
export const FIRING_ORDER = [1, 5, 3, 7, 4, 8, 2, 6];
export const CYLINDERS = FIRING_ORDER.length;
/** Each pin carries one rod from each bank. */
export const CRANK_PINS: [number, number][] = [
  [1, 5],
  [2, 6],
  [3, 7],
  [4, 8],
];
export const isBankA = (cyl: number) => cyl <= 4;

export const DISPLACEMENT_CC = (Math.PI / 4) * (BORE_MM / 10) ** 2 * (STROKE_MM / 10) * CYLINDERS;
export const REVS_PER_SECOND = REDLINE / 60;
const OMEGA = (2 * Math.PI * REDLINE) / 60;
/** Crank-radius term of piston acceleration, r·ω². The rod adds to it at TDC, so this is a floor. */
export const PISTON_ACCEL_MIN_G = ((STROKE_MM / 2000) * OMEGA * OMEGA) / 9.80665;
/** Inertial pull of the piston alone at that floor, in tonnes-force. */
export const PISTON_PULL_MIN_TONNES = (PISTON_ACCEL_MIN_G * PISTON_G) / 1e6;

// ---- the beat ----
// House tempo on whole frames: 14 frames per beat is 128.57 BPM. A cycle of 8 bangs at the
// lowest slowed speed is exactly 2 bars, one stroke is 2 beats and one bank fires on every other beat.
export const FRAMES_PER_BEAT = 14;
export const BPM = (60 * meta.fps) / FRAMES_PER_BEAT;
export const BEATS_PER_BAR = 4;
export const BARS = 18;
/** On-screen time of a beat. Written as a single division so grid times match the crank table exactly. */
export const beatT = (beat: number) => (beat * FRAMES_PER_BEAT) / meta.fps;
export const barT = (bar: number) => beatT(bar * BEATS_PER_BAR);

const REDLINE_BANGS = (REDLINE / 60) * (CYLINDERS / 2);
/** At this slowdown, redline is 16th notes, half redline 8ths, and quarter redline four-on-the-floor. */
export const SLOW = REDLINE_BANGS / ((BPM / 60) * 4);
export const QUARTER_REV = REDLINE / 4;
export const HALF_REV = REDLINE / 2;

export const SLOW_START = barT(2);
export const REAL_SPEED_START = barT(12);
export const DROP = barT(14);

export const isSlowed = (t: number) => t >= SLOW_START && t < REAL_SPEED_START;
export const slowAt = (t: number) => (isSlowed(t) ? SLOW : 1);
/** For bang timestamps: the crank table can place a bang a hair before a boundary, so test just after it. */
export const isSlowedBang = (t: number) => isSlowed(t + 1e-6);

export const rpmAt = (t: number): number => {
  if (t < SLOW_START) return REDLINE;
  if (t < barT(6)) return QUARTER_REV;
  if (t < barT(10)) return HALF_REV;
  if (t < REAL_SPEED_START) return REDLINE;
  // Back at real speed the engine climbs in octaves, then screams into the drop alone.
  if (t < barT(13)) return QUARTER_REV;
  if (t < beatT(54)) return HALF_REV;
  if (t < DROP) return ramp(t, beatT(54), DROP, HALF_REV, REDLINE);
  if (t < barT(17)) return REDLINE;
  return ramp(t, barT(17), beatT(71), REDLINE, QUARTER_REV);
};

// Cylinder 1 fires exactly on this downbeat, which puts every slowed bang on the grid.
export const BANG_BEAT = barT(4);

export const engine = createFourStroke({
  firingOrder: FIRING_ORDER,
  durationS: meta.durationS,
  rpmAt,
  slowAt,
  phaseLockT: BANG_BEAT,
});

export const { crankAt, cycleAt, bangs: BANGS, firstBangAfter, bangsPerSecond } = engine;

/** Valve windows in cycle degrees, from the 19/64 timing in [V] Table 1 (see the header comment). */
export const INTAKE_VALVE = { open: 360 - 19, close: 540 + 64, peak: (360 - 19 + 540 + 64) / 2 };
export const EXHAUST_VALVE = { open: 180 - 64, close: 360 + 19, peak: (180 - 64 + 360 + 19) / 2 };

/** The engine's redline note. The song is tuned so this is exactly its tonic, D#. */
export const ENGINE_NOTE_HZ = bangsPerSecond(REDLINE);
const ENGINE_MIDI = 87; // D#6
/** A4 for the song, set so MIDI D#6 is exactly the engine's redline note. */
export const SONG_A4_HZ = ENGINE_NOTE_HZ / 2 ** ((ENGINE_MIDI - 69) / 12);
/** The sub bass root, D#1: the engine's note five octaves down. */
export const SUB_HZ = ENGINE_NOTE_HZ / 32;

/**
 * Sections held at redline at real speed, clear of rev ramps. The search band sits above the
 * sub, growl, chords and lead, so the check measures the engine and not the music.
 */
const ENGINE_BAND = { minHz: 1100, maxHz: 1500 };
export const toneChecks: ToneCheck[] = [
  { label: "opening", from: 0.06, to: barT(2) - 0.1, expectedHz: ENGINE_NOTE_HZ, ...ENGINE_BAND },
  { label: "finale", from: DROP + 0.1, to: barT(17) - 0.1, expectedHz: ENGINE_NOTE_HZ, ...ENGINE_BAND },
];
