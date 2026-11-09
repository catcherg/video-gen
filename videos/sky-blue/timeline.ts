// Camera keys, shot titles, live diagrams and every hit the picture follows.
//
// Bars   Shot                     Subject                        Diagram
//  0-1   Earth from space         The hook, on the song's stabs  none
//  2-3   Light fanning out        Sunlight is every colour       none
//  4-5   Air close-up             Light meets molecules          none
//  6-7   Air, closer              Blue scatters more             Scatter curve
//  8-9   An eye                   Why violet loses               Comparison
//  10-11 The ground at noon       Blue from every direction      none
//  12-13 The drop: sunset         The sky turns                  Air crossed
//  14-15 Earth from the side      The long path through air      Air crossed
//  16-17 Sunset                   What is left                   none
import * as THREE from "three";
import { makeCameraRig, type CameraFn, type CameraKey, type V3 } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import type { DiagramSpec } from "../../src/core/diagrams/spec";
import { fmtInt, hash } from "../../src/core/math";
import { hitPulse, progress, shake } from "../../src/core/motion";
import { resolveCaptions, resolveTime } from "../../src/core/spec";
import { meta, spec } from "./meta";
import { barT, beatT, BLUE_VS_RED, HORIZON_AIR_MASS, LIGHT_BANDS, RED_NM, scatterRelativeToBlue } from "./physics";
import { SONG_MAP } from "./songMap";

const seconds = (frames: number[]) => frames.map((f) => f / SONG_MAP.fps);

export const KICKS = seconds(SONG_MAP.kickFrames);
export const STABS = seconds(SONG_MAP.stabFrames);
export const IMPACTS = seconds(SONG_MAP.impactFrames ?? []);

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  ratio: fmtInt(BLUE_VS_RED),
  airMass: fmtInt(HORIZON_AIR_MASS),
});

/** Where each set stands in the world, far enough apart that no camera sees another set. */
export const SETS = { space: 0, split: 150, air: 300, eye: 450, ground: 600 };

const CUT = 1 / 30;
/** Share of the camera distance to aim below a subject, which lifts it into the top half of the frame, above the captions. */
const LIFT = 0.13;

const hold = (from: number, to: number, pos0: V3, pos1: V3, subject: V3): CameraKey[] => {
  const aim = (pos: V3): V3 => [subject[0], subject[1] - LIFT * Math.hypot(pos[0] - subject[0], pos[1] - subject[1], pos[2] - subject[2]), subject[2]];
  return [
    { t: from, pos: pos0, target: aim(pos0), fov: 40 },
    { t: to - CUT, pos: pos1, target: aim(pos1), fov: 40 },
  ];
};

/** Air molecules in the close-up, relative to its set. */
export const MOLECULES = Array.from({ length: 12 }, (_, i): V3 => [(hash(i, 40) - 0.5) * 22, (hash(i, 41) - 0.5) * 26 + 2, (hash(i, 42) - 0.5) * 6]);

const { space, split, air, eye, ground } = SETS;
const rig = makeCameraRig([
  ...hold(0, barT(2), [0, 7, 88], [0, 7, 80], [0, 7, 0]),
  ...hold(barT(2), barT(4), [split + 1, 2, 66], [split + 1, 2, 60], [split + 1, 1, 0]),
  ...hold(barT(4), barT(6), [air, 0, 42], [air, 0, 36], [air, 0, 0]),
  ...hold(barT(6), barT(8), [air + 2, 1, 30], [air + 2, 1, 26], [air + 2, 1, 0]),
  ...hold(barT(8), barT(10), [eye, 2, 62], [eye, 2, 56], [eye, 3, 0]),
  ...hold(barT(10), barT(12), [ground, 9, 54], [ground, 8, 46], [ground, 3, 0]),
  ...hold(barT(12), barT(14), [ground, 7, 50], [ground, 7, 44], [ground, 3, 0]),
  ...hold(barT(14), barT(16), [space + 6, 10, 96], [space + 6, 10, 88], [space + 6, 9.6, 0]),
  ...hold(barT(16), barT(18) + 0.2, [ground, 7, 46], [ground, 7, 38], [ground, 3, 0]),
]);

const KICK_ZOOM_DEG = 1.2;
const IMPACT_SHAKE = 0.9;

/** The keyframed camera, with a punch on every kick and a shake on the drop. */
export const cameraAt: CameraFn = (t) => {
  const pose = rig(t);
  pose.fov -= KICK_ZOOM_DEG * hitPulse(t, KICKS);
  pose.pos.add(new THREE.Vector3(shake(t, IMPACTS, IMPACT_SHAKE, 11, 18, 0.35), shake(t, IMPACTS, IMPACT_SHAKE, 12, 18, 0.35), 0));
  return pose;
};

/** A section title for each shot from the third bar on. */
export const TITLES: { from: number; to: number; text: string }[] = [
  { from: barT(2), to: barT(4), text: "WHITE LIGHT" },
  { from: barT(4), to: barT(8), text: "SCATTERING" },
  { from: barT(8), to: barT(10), text: "WHY NOT VIOLET?" },
  { from: barT(10), to: barT(12), text: "NOON" },
  { from: barT(12), to: barT(14), text: "SUNSET" },
  { from: barT(14), to: barT(16), text: "THE LONG WAY" },
  { from: barT(16), to: barT(17), text: "SUNSET" },
];

/** How far a sunset has gone: quick, so that the colour change lands on the drop. */
export const sunsetAmount = (t: number) => progress(t, barT(12) - beatT(0.5), barT(12) + beatT(1));

const NM_STEP = 25;
const CURVE_FROM_NM = LIGHT_BANDS[0].nm - (LIGHT_BANDS[0].nm % NM_STEP);

export const DIAGRAMS: Record<string, DiagramSpec> = {
  scatter: {
    type: "line",
    title: "SCATTERING BY WAVELENGTH",
    xLabel: "NANOMETRES",
    series: [{ label: "SCATTERING", points: Array.from({ length: Math.floor((RED_NM + NM_STEP - CURVE_FROM_NM) / NM_STEP) }, (_, i): [number, number] => [CURVE_FROM_NM + i * NM_STEP, scatterRelativeToBlue(CURVE_FROM_NM + i * NM_STEP)]) }],
  },
  violet: {
    type: "comparison",
    title: "WHY THE SKY LOOKS BLUE",
    left: "VIOLET",
    right: "BLUE",
    rows: [
      { label: "SCATTERS", left: "THE MOST", right: "A LOT" },
      { label: "IN SUNLIGHT", left: "LESS", right: "MORE" },
      { label: "OUR EYES", left: "WEAK", right: "STRONG" },
    ],
  },
  airMass: {
    type: "bar",
    title: "AIR THE LIGHT CROSSES",
    unit: "×",
    bars: [
      { label: "OVERHEAD", value: 1 },
      { label: "SUNSET", value: HORIZON_AIR_MASS },
    ],
  },
};

/** Which diagram is showing, from the shot list in the spec. */
export const SHOT_WINDOWS = spec.shots.map((shot) => ({ from: resolveTime(spec, shot.from), to: resolveTime(spec, shot.to), diagram: shot.diagram }));

export const END_FADE_FROM = meta.durationS - 0.7;
