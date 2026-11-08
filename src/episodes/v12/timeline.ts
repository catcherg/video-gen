// Camera keys, captions and label windows. Numbers in captions come from physics.
import { makeCameraRig, type CameraKey } from "../../core/camera";
import type { Caption } from "../../core/Captions";
import { meanPistonSpeed } from "../../core/engine/fourStroke";
import { fmtInt, noteName } from "../../core/math";
import { bangsPerSecond, CAMSHAFTS, CRANK_PINS, CYLINDERS, REDLINE, SLOW, STROKE_MM, VALVES_PER_CYLINDER } from "./physics";

const KEYS: CameraKey[] = [
  // exterior, rear three-quarter
  { t: 0.0, pos: [63.6, 33.8, 48], target: [6, 5, 0], fov: 40 },
  { t: 2.9, pos: [59, 32, 54], target: [7, 5.5, 0], fov: 40 },
  // engine rises, look down the V from behind: left/right banks
  { t: 4.7, pos: [27.5, 28, 7], target: [11, 14.6, 0], fov: 42 },
  { t: 6.2, pos: [27, 27.5, 4.5], target: [11, 14.6, 0], fov: 42 },
  // front cross-section of cylinders 1 & 7: the four strokes
  { t: 7.0, pos: [-1.3, 18.9, -5.3], target: [8.1, 15.4, -0.6], fov: 40, via: [5, 27, -10] },
  { t: 10.4, pos: [-0.8, 18.4, -6.0], target: [8.1, 15.2, -0.6], fov: 40 },
  // low side view: crankshaft and rods (right-bank headers ghosted)
  { t: 11.3, pos: [5.5, 10.6, -17.5], target: [11, 14.1, 0], fov: 40 },
  { t: 14.6, pos: [7.5, 10.6, -18], target: [11, 14.1, 0], fov: 40 },
  // above: four cams, 48 valves
  { t: 15.5, pos: [16, 35, -6.5], target: [11, 16.6, 0], fov: 40 },
  { t: 18.9, pos: [14, 35, -7.5], target: [11, 16.6, 0], fov: 40 },
  // wide 3/4 of the whole engine at redline
  { t: 19.8, pos: [24.5, 24.5, -14.5], target: [11, 14.8, 0], fov: 42 },
  { t: 22.5, pos: [25.5, 24, -17], target: [11, 14.8, 0], fov: 42 },
  // pull back out to the car at real speed
  { t: 25.4, pos: [62, 31.4, -50.4], target: [6, 5, 0], fov: 40 },
  { t: 32.0, pos: [67, 28, -43], target: [6, 5, 0], fov: 40 },
];

export const cameraAt = makeCameraRig(KEYS);

const REDLINE_TXT = fmtInt(REDLINE);
const TONE_HZ = bangsPerSecond(REDLINE);
const TONE_NOTE = noteName(TONE_HZ);

export const CAPTIONS: Caption[] = [
  { from: 0.25, to: 2.95, lines: [`${REDLINE_TXT} RPM. ${CYLINDERS} CYLINDERS.`, "WHAT MAKES THE SCREAM?"], size: "big", y: 300 },
  { from: 3.3, to: 6.4, lines: [`SLOWED DOWN ${SLOW}×`, "EACH CLICK = ONE BANG"] },
  { from: 6.6, to: 8.0, lines: ["EACH CYLINDER RUNS 4 STROKES"] },
  { from: 8.0, to: 10.6, lines: ["ONLY ONE OF THEM IS A BANG"] },
  { from: 10.9, to: 12.3, lines: [`${CYLINDERS} RODS ON ${CRANK_PINS.length} CRANK PINS`] },
  { from: 12.3, to: 14.6, lines: [`= ${CYLINDERS / 2} BANGS PER REVOLUTION`] },
  { from: 15.0, to: 16.3, lines: [`${CAMSHAFTS} CAMSHAFTS, ${CYLINDERS * VALVES_PER_CYLINDER} VALVES`] },
  { from: 16.3, to: 18.8, lines: ["DOUBLE THE RPM,", "DOUBLE THE BANGS"] },
  { from: 19.1, to: 20.5, lines: [`ONE BANG EVERY ${720 / CYLINDERS}°`, "OF ROTATION"] },
  { from: 20.5, to: 22.4, lines: [`REDLINE: ${REDLINE_TXT} RPM`, `PISTONS AVERAGE ${fmtInt(meanPistonSpeed(STROKE_MM, REDLINE))} M/S`] },
  { from: 22.6, to: 25.2, lines: ["BACK TO REAL SPEED"] },
  { from: 25.3, to: 28.1, lines: [`${fmtInt(TONE_HZ)} BANGS A SECOND.`, "YOUR EAR CAN'T SPLIT THEM."] },
  { from: 28.2, to: 31.7, lines: ["IT HEARS ONE NOTE:", `${fmtInt(TONE_HZ)} HZ, JUST ${TONE_NOTE.cents < 0 ? "UNDER" : "OVER"} ${TONE_NOTE.name}.`, "THAT'S THE SCREAM."] },
];

// Which overlay labels are on screen when.
export const SHOW_BANK_LABELS = (t: number) => t > 4.4 && t < 6.5;
export const SHOW_STROKE_TAG = (t: number) => t > 6.9 && t < 10.4;
export const SHOW_CYL_NUMBERS = (t: number) => (t > 4.4 && t < 6.5) || (t > 14.8 && t < 23.0);
export const SHOW_CRANK_TAG = (t: number) => t > 11.4 && t < 14.6;
/** Right-bank exhaust headers turn see-through for the crankshaft shot. */
export const headerGhost = (t: number) => Math.max(0, Math.min(1, Math.min((t - 10.5) / 0.5, (14.9 - t) / 0.5)));
export const HUD_IN = 3.05;
export const END_FADE_FROM = 31.5;
