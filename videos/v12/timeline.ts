// Camera keys and label windows, all placed on the song's bars and beats.
// Caption text and timing live in spec.json; the numbers in them are computed here from physics.
import { makeCameraRig, type CameraFn, type CameraKey } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import { meanPistonSpeed } from "../../src/kits/engine/fourStroke";
import { fmtInt, noteName } from "../../src/core/math";
import { resolveCaptions } from "../../src/core/spec";
import { spec } from "./meta";
import { bangsPerSecond, barT, beatT, BPM, CAMSHAFTS, CRANK_PINS, CYLINDERS, REDLINE, SLOW, STROKE_MM, VALVES_PER_CYLINDER } from "./physics";
import { kickPulse } from "./song";

const KEYS: CameraKey[] = [
  // exterior, rear three-quarter
  { t: 0.0, pos: [63.6, 33.8, 48], target: [6, 5, 0], fov: 40 },
  { t: barT(2), pos: [59, 32, 54], target: [7, 5.5, 0], fov: 40 },
  // engine rises, look down the V from behind: left/right banks
  { t: barT(3), pos: [27.5, 28, 7], target: [11, 14.6, 0], fov: 42 },
  { t: barT(4), pos: [27, 27.5, 4.5], target: [11, 14.6, 0], fov: 42 },
  // head-on view of the front pair of cylinders: the four strokes
  { t: beatT(18), pos: [-9.5, 18.2, -2.2], target: [8.1, 15.2, -0.2], fov: 40, via: [2, 30, -12] },
  { t: beatT(26), pos: [-9.5, 17.8, -1.4], target: [8.1, 15.2, -0.2], fov: 40 },
  // level side view: crankshaft and rods (right-bank headers ghosted)
  { t: barT(7), pos: [9.5, 14.8, -21.5], target: [11, 14.2, 0], fov: 40 },
  { t: barT(9), pos: [12, 14.8, -21.5], target: [11, 14.2, 0], fov: 40 },
  // above: four cams, 48 valves
  { t: barT(10), pos: [15, 36, -6.5], target: [11, 15.8, 0], fov: 40 },
  { t: barT(12), pos: [13.5, 36, -7.5], target: [11, 15.8, 0], fov: 40 },
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

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  redline: REDLINE_TXT,
  cylinders: CYLINDERS,
  slow: SLOW,
  bpm: BPM,
  pins: CRANK_PINS.length,
  bangsPerRev: CYLINDERS / 2,
  camshafts: CAMSHAFTS,
  valves: CYLINDERS * VALVES_PER_CYLINDER,
  degPerBang: 720 / CYLINDERS,
  pistonSpeed: fmtInt(meanPistonSpeed(STROKE_MM, REDLINE)),
  toneHz: fmtInt(TONE_HZ),
  toneSide: TONE_NOTE.cents < 0 ? "UNDER" : "OVER",
  toneNote: TONE_NOTE.name,
});

// Which overlay labels are on screen when.
export const SHOW_BANK_LABELS = (t: number) => t > barT(3) - 0.2 && t < barT(4);
export const SHOW_STROKE_TAG = (t: number) => t > beatT(18) && t < beatT(26);
export const SHOW_CYL_NUMBERS = (t: number) => (t > barT(3) - 0.2 && t < barT(4)) || (t > barT(10) && t < barT(14));
export const SHOW_CRANK_TAG = (t: number) => t > barT(7) && t < barT(9);
/** Right-bank exhaust headers turn see-through for the crankshaft shot. */
export const headerGhost = (t: number) => Math.max(0, Math.min(1, Math.min((t - 10.6) / 0.5, (15.6 - t) / 0.5)));
/** Which part of the engine a shot is about. Everything else fades back so the subject reads clearly. */
export type FocusKind = "none" | "strokes" | "crank" | "cams";
export const focusAt = (t: number): { kind: FocusKind; amount: number } => {
  const windowed = (kind: FocusKind, from: number, to: number) => ({
    kind,
    amount: Math.max(0, Math.min(1, Math.min((t - from) / 0.3, (to - t) / 0.3))),
  });
  if (t >= beatT(17) && t < beatT(27)) return windowed("strokes", beatT(17), beatT(27));
  if (t >= beatT(27) && t < beatT(39.5)) return windowed("crank", beatT(27), beatT(39.5));
  if (t >= beatT(39.5) && t < barT(12)) return windowed("cams", beatT(39.5), barT(12));
  return { kind: "none", amount: 0 };
};

/** Which live diagram sits under the captions. */
export type PanelKind = "firing" | "stroke" | "crank" | "valves" | "pulses";
export const panelAt = (t: number): { kind: PanelKind; fade: number } | null => {
  const span = (kind: PanelKind, from: number, to: number) => (t >= from && t < to ? { kind, fade: Math.max(0, Math.min(1, Math.min((t - from) / 0.15, (to - t) / 0.15))) } : null);
  return (
    span("firing", barT(2) + 0.2, beatT(16)) ??
    span("stroke", beatT(16), beatT(28)) ??
    span("crank", beatT(28), beatT(40)) ??
    span("valves", beatT(40), barT(12)) ??
    span("firing", barT(12), barT(14)) ??
    span("pulses", barT(14), barT(20) - 0.1)
  );
};

/** The belt and alternator sit between the camera and the piston in the front close-up, so they hide for it. */
export const SHOW_FRONT_DRIVE = (t: number) => t < beatT(16) || t > beatT(28);
export const HUD_IN = barT(2) + 0.05;
export const END_FADE_FROM = 31.5;
