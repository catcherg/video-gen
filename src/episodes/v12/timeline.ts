// Camera keys, captions and label windows, all placed on the song's bars and beats.
// Numbers in captions come from physics.
import { makeCameraRig, type CameraFn, type CameraKey } from "../../core/camera";
import type { Caption } from "../../core/Captions";
import { meanPistonSpeed } from "../../core/engine/fourStroke";
import { fmtInt, noteName } from "../../core/math";
import { bangsPerSecond, barT, beatT, BPM, CAMSHAFTS, CRANK_PINS, CYLINDERS, REDLINE, SLOW, STROKE_MM, VALVES_PER_CYLINDER } from "./physics";
import { kickPulse } from "./song";

const KEYS: CameraKey[] = [
  // exterior, rear three-quarter
  { t: 0.0, pos: [63.6, 33.8, 48], target: [6, 5, 0], fov: 40 },
  { t: barT(2), pos: [59, 32, 54], target: [7, 5.5, 0], fov: 40 },
  // engine rises, look down the V from behind: left/right banks
  { t: barT(3), pos: [27.5, 28, 7], target: [11, 14.6, 0], fov: 42 },
  { t: barT(4), pos: [27, 27.5, 4.5], target: [11, 14.6, 0], fov: 42 },
  // front cross-section of cylinders 1 & 7: the four strokes
  { t: beatT(18), pos: [-1.3, 18.9, -5.3], target: [8.1, 15.4, -0.6], fov: 40, via: [5, 27, -10] },
  { t: beatT(26), pos: [-0.8, 18.4, -6.0], target: [8.1, 15.2, -0.6], fov: 40 },
  // low side view: crankshaft and rods (right-bank headers ghosted)
  { t: barT(7), pos: [5.5, 10.6, -17.5], target: [11, 14.1, 0], fov: 40 },
  { t: barT(9), pos: [7.5, 10.6, -18], target: [11, 14.1, 0], fov: 40 },
  // above: four cams, 48 valves
  { t: barT(10), pos: [16, 35, -6.5], target: [11, 16.6, 0], fov: 40 },
  { t: barT(12), pos: [14, 35, -7.5], target: [11, 16.6, 0], fov: 40 },
  // wide 3/4 of the whole engine at redline
  { t: beatT(50), pos: [24.5, 24.5, -14.5], target: [11, 14.8, 0], fov: 42 },
  { t: barT(14), pos: [25.5, 24, -17], target: [11, 14.8, 0], fov: 42 },
  // pull back out to the car at real speed
  { t: barT(16), pos: [62, 31.4, -50.4], target: [6, 5, 0], fov: 40 },
  { t: barT(20), pos: [67, 28, -43], target: [6, 5, 0], fov: 40 },
];

const rig = makeCameraRig(KEYS);
const KICK_ZOOM_DEG = 1.1;

/** The keyframed camera, with a small zoom punch on every kick. */
export const cameraAt: CameraFn = (t) => {
  const pose = rig(t);
  pose.fov -= KICK_ZOOM_DEG * kickPulse(t);
  return pose;
};

const REDLINE_TXT = fmtInt(REDLINE);
const TONE_HZ = bangsPerSecond(REDLINE);
const TONE_NOTE = noteName(TONE_HZ);

export const CAPTIONS: Caption[] = [
  { from: 0.25, to: barT(2) - 0.08, lines: [`${REDLINE_TXT} RPM. ${CYLINDERS} CYLINDERS.`, "WHAT MAKES THE SCREAM?"], size: "big", y: 300 },
  { from: barT(2) + 0.1, to: barT(4) - 0.1, lines: [`SLOWED DOWN ${SLOW}×`, `EVERY BANG IS A BEAT: ${BPM} BPM`] },
  { from: barT(4), to: barT(5), lines: ["EACH CYLINDER RUNS 4 STROKES"] },
  { from: barT(5), to: beatT(26), lines: ["ONLY ONE OF THEM IS A BANG"] },
  { from: barT(7), to: barT(8) - 0.1, lines: [`${CYLINDERS} RODS ON ${CRANK_PINS.length} CRANK PINS`] },
  { from: barT(8), to: barT(10) - 0.1, lines: [`= ${CYLINDERS / 2} BANGS PER REVOLUTION`] },
  { from: barT(10), to: barT(11) - 0.1, lines: [`${CAMSHAFTS} CAMSHAFTS, ${CYLINDERS * VALVES_PER_CYLINDER} VALVES`] },
  { from: barT(11), to: barT(12) - 0.1, lines: ["DOUBLE THE RPM,", "DOUBLE THE BANGS"] },
  { from: barT(12), to: barT(13) - 0.05, lines: [`ONE BANG EVERY ${720 / CYLINDERS}°`, "OF ROTATION"] },
  { from: barT(13), to: barT(14) - 0.05, lines: [`REDLINE: ${REDLINE_TXT} RPM`, `PISTONS AVERAGE ${fmtInt(meanPistonSpeed(STROKE_MM, REDLINE))} M/S`] },
  { from: barT(14) + 0.1, to: barT(16) - 0.1, lines: ["BACK TO REAL SPEED"] },
  { from: barT(16), to: barT(18) - 0.1, lines: [`${fmtInt(TONE_HZ)} BANGS A SECOND.`, "YOUR EAR CAN'T SPLIT THEM."] },
  { from: barT(18), to: barT(20) - 0.3, lines: ["IT HEARS ONE NOTE:", `${fmtInt(TONE_HZ)} HZ, JUST ${TONE_NOTE.cents < 0 ? "UNDER" : "OVER"} ${TONE_NOTE.name}.`, "THAT'S THE SCREAM."] },
];

// Which overlay labels are on screen when.
export const SHOW_BANK_LABELS = (t: number) => t > barT(3) - 0.2 && t < barT(4);
export const SHOW_STROKE_TAG = (t: number) => t > beatT(18) && t < beatT(26);
export const SHOW_CYL_NUMBERS = (t: number) => (t > barT(3) - 0.2 && t < barT(4)) || (t > barT(10) && t < barT(14));
export const SHOW_CRANK_TAG = (t: number) => t > barT(7) && t < barT(9);
/** Right-bank exhaust headers turn see-through for the crankshaft shot. */
export const headerGhost = (t: number) => Math.max(0, Math.min(1, Math.min((t - 10.6) / 0.5, (15.6 - t) / 0.5)));
/** The belt and alternator sit between the camera and the piston in the front close-up, so they hide for it. */
export const SHOW_FRONT_DRIVE = (t: number) => t < beatT(16) || t > beatT(28);
export const HUD_IN = barT(2) + 0.05;
export const END_FADE_FROM = 31.5;
