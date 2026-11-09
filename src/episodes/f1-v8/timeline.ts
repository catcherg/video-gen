// Camera keys, captions and label windows, all placed on the song's bars and beats.
// Numbers in captions come from physics.
//
// Shot list:
// Bars   Shot                       Subject                Diagram
//  0-1   Six cuts on the 3-3-2 hits  The hook              none (title lands word by word)
//  2-3   Engine rises out of car    The V8 and its banks   Firing order
//  4-5   Head-on, cylinder 1        Four strokes           Cylinder and dial
//  6-7   Level side view            Flat-plane crank       Crank, end on
//  8     Front                      Gear train             Valve timing
//  9     Head section, cylinder 1   Cam, finger, valve     Valve timing
//  10-11 Close on one valve         Air spring             Air spring section
//  12    Wide, engine drops in      Whole engine           Exhaust pulses
//  13    Behind the car on the grid Landing, five lights   Exhaust pulses
//  14-17 Lights out, the race start The payoff             Exhaust pulses
import * as THREE from "three";
import { makeCameraRig, type CameraFn, type CameraKey } from "../../core/camera";
import type { Caption } from "../../core/Captions";
import { fmtInt, hash, noteName } from "../../core/math";
import { heroS, HERO_Z, LIFT, TRACK_FROM } from "./geometry";
import { barT, beatT, DROP, BORE_MM, bangsPerSecond, CRANK_PINS, ENGINE_MASS_KG, INTAKE_LIFT_MM, PISTON_G, PISTON_PULL_MIN_TONNES, REDLINE, SLOW, STROKE_MM, SUB_HZ, VALVE_ACCEL_G } from "./physics";
import { kickPulse, STABS, stabPulse } from "./beatmap";
import { growlPulse } from "./song";

const Y = 1.335 + LIFT; // crank height with the engine raised
const CUT = 1 / 30;

/** One hook shot, cut in on a stab and held until the next one. */
const hookShot = (from: number, to: number, pos0: [number, number, number], pos1: [number, number, number], target: [number, number, number]): CameraKey[] => [
  { t: from, pos: pos0, target, fov: 40 },
  { t: to - CUT, pos: pos1, target, fov: 40 },
];

// Six cuts, one on each of the song's 3-3-2 hits.
const HOOK = STABS;
const KEYS: CameraKey[] = [
  ...hookShot(HOOK[0], HOOK[1], [76, 15, 24], [73, 14, 25], [5, 4.8, 0]),
  ...hookShot(HOOK[1], HOOK[2], [52, 4.4, -3], [47, 4.6, -3], [18, 6, 0]),
  ...hookShot(HOOK[2], HOOK[3], [30, 20, 26], [28, 19, 26], [8, 5, 0]),
  ...hookShot(HOOK[3], HOOK[4], [-46, 3.8, 24], [-42, 3.8, 24], [-12, 4.2, 0]),
  ...hookShot(HOOK[4], HOOK[5], [-6, 74, 30], [-5, 70, 28], [2, 3, 0]),
  { t: HOOK[5], pos: [74, 16, 26], target: [5.5, 5.2, 0], fov: 40 },
  { t: barT(2), pos: [68, 14, 29], target: [6, 5.5, 0], fov: 40 },
  // the engine rises and the camera climbs with it
  { t: beatT(13), pos: [20.5, Y + 12, 12.5], target: [6.5, Y + 0.9, 0], fov: 40 },
  { t: beatT(14.5), pos: [20, Y + 12, 11.5], target: [6.5, Y + 0.9, 0], fov: 40 },
  // head-on to cylinder 1: the four strokes
  { t: barT(4), pos: [-3.15, Y + 0.95, -1.0], target: [4.85, Y + 0.55, -1.0], fov: 40, via: [-3, Y + 13, -10] },
  { t: beatT(23), pos: [-2.85, Y + 0.93, -1.0], target: [4.85, Y + 0.55, -1.0], fov: 40 },
  // level side view: the whole crank, then in on two pins
  { t: barT(6), pos: [7.2, Y + 0.1, -13.5], target: [6.55, Y - 0.35, 0], fov: 40, via: [-9, Y + 2, -11] },
  { t: beatT(27.5), pos: [6.9, Y + 0.1, -13.5], target: [6.55, Y - 0.35, 0], fov: 40 },
  { t: barT(7), pos: [7.55, Y + 0.05, -8.2], target: [7.55, Y - 0.2, 0], fov: 40 },
  { t: beatT(31.25), pos: [7.35, Y + 0.05, -8.2], target: [7.55, Y - 0.2, 0], fov: 40 },
  // front: the whole gear train, then in on one bank
  { t: barT(8), pos: [-9.4, Y + 0.7, 0.4], target: [3.8, Y + 0.25, 0], fov: 40, via: [-6, Y + 4, -13] },
  { t: beatT(33.5), pos: [-9.4, Y + 0.7, -0.2], target: [3.8, Y + 0.25, 0], fov: 40 },
  { t: beatT(34), pos: [-4.5, Y + 1.3, -1.0], target: [3.8, Y + 0.85, -1.0], fov: 40 },
  { t: beatT(35.5), pos: [-4.2, Y + 1.3, -1.0], target: [3.8, Y + 0.85, -1.0], fov: 40 },
  // the head of cylinder 1 in section: cam, finger, valve
  { t: barT(9), pos: [-0.2, Y + 1.85, -1.6], target: [4.6, Y + 1.4, -1.6], fov: 40 },
  { t: beatT(39.5), pos: [0.05, Y + 1.85, -1.6], target: [4.6, Y + 1.4, -1.6], fov: 40 },
  // close on one valve and its air spring
  { t: barT(10), pos: [1.5, Y + 1.92, -1.31], target: [4.6, Y + 1.6, -1.31], fov: 40 },
  { t: beatT(47), pos: [1.95, Y + 1.9, -1.31], target: [4.6, Y + 1.6, -1.31], fov: 40 },
  // pull out as the engine drops back into the car, a notch per kick
  { t: barT(12), pos: [25.5, Y + 8, -11], target: [7, Y + 0.7, 0], fov: 40 },
  { t: TRACK_FROM - CUT, pos: [62, 15, -26], target: [5, 5, 0], fov: 40 },
  // From here on, positions are relative to the car on the track.
  // the climax: behind the car on its grid box, looking up at the lights
  { t: TRACK_FROM, pos: [70, 8, 0], target: [-50, 8.1, 0], fov: 40 },
  { t: DROP - CUT, pos: [64, 8, 0], target: [-50, 8.1, 0], fov: 40 },
  // lights out: high over the whole grid, which launches away from the camera
  { t: DROP, pos: [292, 58, 14], target: [-30, 8, 14], fov: 40 },
  { t: beatT(58) - CUT, pos: [272, 54, 14], target: [-30, 8, 14], fov: 40 },
  // from the front, the field behind the car, which is coming straight at the camera
  { t: beatT(58), pos: [-92, 7, 14], target: [24, 4.5, -3], fov: 40 },
  { t: barT(15) - CUT, pos: [-78, 6.5, 14], target: [24, 4.5, -3], fov: 40 },
  // cuts every two beats
  { t: barT(15), pos: [68, 7, 2], target: [-16, 5, 0], fov: 40 },
  { t: beatT(62) - CUT, pos: [62, 7, 2], target: [-16, 5, 0], fov: 40 },
  { t: beatT(62), pos: [-62, 4, 18], target: [0, 5, 0], fov: 40 },
  { t: barT(16) - CUT, pos: [-58, 4.2, 20], target: [0, 5, 0], fov: 40 },
  { t: barT(16), pos: [-4, 116, 5.2], target: [-1, 3, 0], fov: 40 },
  { t: beatT(66) - CUT, pos: [-4, 110, 5.2], target: [-1, 3, 0], fov: 40 },
  { t: beatT(66), pos: [76, 24, -32], target: [-6, 6, 0], fov: 40 },
  { t: barT(17) - CUT, pos: [72, 23, -33], target: [-6, 6, 0], fov: 40 },
  // the camera stops following and the car disappears up the road, the field passing either side
  { t: barT(17), pos: [60, 9, 14], target: [-80, 10, 2], fov: 40 },
  { t: barT(18), pos: [60, 9, 14], target: [-80, 10, 2], fov: 40 },
];

const rig = makeCameraRig(KEYS);
const KICK_ZOOM_DEG = 1.3;
const HOOK_KICK_ZOOM_DEG = 3.2;
const STUDIO_KICK_ZOOM_DEG = 2.4;
const SHAKE = 0.15;
const FOLLOW_FROM = beatT(58);
const FOLLOW_UNTIL = beatT(69);

/** How far the camera's frame has moved along the track at time t. */
const followX = (t: number) => (t < FOLLOW_FROM ? 0 : -heroS(Math.min(t, FOLLOW_UNTIL)));

/** The keyframed camera, with a zoom punch on every kick and a shake on the bass notes and stabs. */
export const cameraAt: CameraFn = (t) => {
  const pose = rig(t);
  if (t >= TRACK_FROM) {
    const follow = new THREE.Vector3(followX(t), 0, HERO_Z);
    pose.pos.add(follow);
    pose.target.add(follow);
  }
  pose.fov -= (t < barT(2) ? HOOK_KICK_ZOOM_DEG : STUDIO(t) ? STUDIO_KICK_ZOOM_DEG : KICK_ZOOM_DEG) * kickPulse(t);
  if (STUDIO(t)) {
    // Never still: a slow sway around the subject, tied to the bar, so the parallax keeps the shot alive.
    const phase = (t / barT(1)) * Math.PI;
    pose.pos.x += Math.sin(phase * 0.5) * 0.12;
    pose.pos.y += Math.cos(phase) * 0.07;
    pose.pos.z += Math.sin(phase) * 0.16;
  }
  const shake = Math.max(growlPulse(t), stabPulse(t, 0.09)) * SHAKE;
  if (shake > 0.001) {
    const f = Math.round(t * 30);
    pose.pos.x += (hash(f, 1) - 0.5) * shake * 6;
    pose.pos.y += (hash(f, 2) - 0.5) * shake * 6;
    pose.pos.z += (hash(f, 3) - 0.5) * shake * 6;
  }
  return pose;
};

const REDLINE_TXT = fmtInt(REDLINE);
const TONE_HZ = bangsPerSecond(REDLINE);
const TONE_NOTE = noteName(TONE_HZ);
const SLOW_TXT = Math.round(SLOW * 10) / 10;

/** The hook's title, as lines of words. Each word lands on one of the six stabs, in order. */
export const HOOK_LINES = [[REDLINE_TXT, "RPM."], ["WHY", "DOESN'T", "IT"], ["FLY APART?"]];
export const HOOK_END = barT(2) - 0.08;

export const CAPTIONS: Caption[] = [
  { from: barT(2) + 0.1, to: barT(4) - 0.1, lines: [`SLOWED DOWN ${SLOW_TXT}×`, "EVERY BANG IS A KICK DRUM"] },
  { from: barT(4), to: barT(5) - 0.08, lines: ["4 STROKES.", "ONLY ONE IS A BANG."] },
  { from: barT(5), to: barT(6) - 0.08, lines: [`${BORE_MM} MM WIDE, ${Math.round(STROKE_MM * 10) / 10} MM TRAVEL:`, "A VERY SHORT STROKE"] },
  { from: barT(6), to: barT(7) - 0.08, lines: [`FLAT CRANK: ${CRANK_PINS.length} PINS,`, "ONE BANG EVERY 90°"] },
  { from: barT(7), to: barT(8) - 0.08, lines: [`EACH ${PISTON_G} G PISTON PULLS`, `OVER ${Math.floor(PISTON_PULL_MIN_TONNES * 10) / 10} TONNES AT REDLINE`] },
  { from: barT(8), to: barT(9) - 0.08, lines: ["NO CHAIN. NO BELT.", "GEARS TURN THE CAMS"] },
  { from: barT(9), to: barT(10) - 0.08, lines: ["FINGER FOLLOWERS", `PUSH VALVES ${INTAKE_LIFT_MM} MM OPEN`] },
  { from: barT(10), to: barT(11) - 0.08, lines: ["AT THIS SPEED", "METAL SPRINGS SURGE"] },
  { from: barT(11), to: barT(12) - 0.08, lines: ["SO COMPRESSED AIR SHUTS", `THE VALVES: OVER ${fmtInt(VALVE_ACCEL_G)} G`] },
  { from: barT(12) + 0.08, to: barT(13) - 0.08, lines: ["BACK TO REAL SPEED"] },
  { from: barT(13), to: barT(14) - 0.08, lines: [`${ENGINE_MASS_KG} KG, BOLTED IN`, "AS PART OF THE CAR"] },
  { from: barT(14), to: barT(15) - 0.08, lines: [`${fmtInt(TONE_HZ)} BANGS A SECOND`] },
  { from: barT(15), to: barT(16) - 0.08, lines: [`YOUR EAR HEARS ONE NOTE:`, `${fmtInt(TONE_HZ)} HZ, ${TONE_NOTE.name.replace(/\d/, "")}`] },
  { from: barT(16), to: barT(17) - 0.08, lines: ["THAT SUB BASS IS THE", `SAME NOTE AT ${SUB_HZ.toFixed(1)} HZ`] },
  { from: barT(17), to: barT(18) - 0.5, lines: ["5 OCTAVES DOWN"] },
];

export const SHOW_BANK_LABELS = (t: number) => t > barT(3) - 0.2 && t < barT(4) - 0.3;
export const SHOW_CYL_NUMBERS = (t: number) => t > barT(3) - 0.2 && t < barT(4) - 0.3;
export const SHOW_STROKE_TAG = (t: number) => t >= barT(4) && t < barT(6) - 0.2;
export const SHOW_CRANK_TAG = (t: number) => t >= barT(6) && t < barT(8) - 0.2;

/** Bank A headers turn see-through for the crankshaft shot, which looks past them. */
export const headerGhost = (t: number) => Math.max(0, Math.min(1, Math.min((t - (barT(6) - 0.3)) / 0.3, (barT(8) - t) / 0.3)));

/** Which part of the engine a shot is about. Everything else fades back so the subject reads clearly. */
export type FocusKind = "none" | "strokes" | "crank" | "gears" | "head" | "air";
export const focusAt = (t: number): { kind: FocusKind; amount: number } => {
  const windowed = (kind: FocusKind, from: number, to: number) => ({ kind, amount: Math.max(0, Math.min(1, Math.min((t - from) / 0.25, (to - t) / 0.25))) });
  if (t >= barT(4) - 0.3 && t < barT(6)) return windowed("strokes", barT(4) - 0.3, barT(6));
  if (t >= barT(6) && t < barT(8)) return windowed("crank", barT(6) - 0.25, barT(8));
  if (t >= barT(8) && t < barT(9)) return windowed("gears", barT(8) - 0.25, barT(9) + 0.25);
  if (t >= barT(9) && t < barT(10)) return windowed("head", barT(9) - 0.25, barT(10) + 0.25);
  if (t >= barT(10) && t < barT(12)) return windowed("air", barT(10) - 0.25, barT(12));
  return { kind: "none", amount: 0 };
};

/** Which live diagram sits under the captions. */
export type PanelKind = "firing" | "stroke" | "crank" | "valves" | "air" | "pulses";
export const panelAt = (t: number): { kind: PanelKind; fade: number } | null => {
  const span = (kind: PanelKind, from: number, to: number) => (t >= from && t < to ? { kind, fade: Math.max(0, Math.min(1, Math.min((t - from) / 0.15, (to - t) / 0.15))) } : null);
  return (
    span("firing", barT(2) + 0.2, barT(4)) ??
    span("stroke", barT(4), barT(6)) ??
    span("crank", barT(6), barT(8)) ??
    span("valves", barT(8), barT(10)) ??
    span("air", barT(10), barT(12)) ??
    span("pulses", barT(12), barT(18) - 0.6)
  );
};

/** The gear train stands between the camera and the head in the section shots, so it hides for them. */
export const SHOW_GEARS = (t: number) => !(t >= barT(4) - 0.3 && t < barT(6) + 0.1) && !(t >= barT(9) - 0.06 && t < barT(12) - 0.1);
/** The close-ups happen in a clean drawing room, with the workshop and car out of the way. */
export const STUDIO = (t: number) => t >= barT(4) && t < barT(12);
/** The slim HUD during the close-ups, which gives the subject more of the frame. */
export const COMPACT_HUD = (t: number) => t >= barT(4) && t < barT(12);
export const HUD_IN = barT(2) + 0.05;
export const END_FADE_FROM = barT(18) - 0.5;
