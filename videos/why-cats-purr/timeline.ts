// Camera keys, shot titles, live diagrams and every hit the picture follows.
//
// Bars        Shot                 Subject                              Diagram
//  0-2        Portrait             The hook: a purring cat              none
//  2-3.25     Wave                 A slow wave leaves the throat        Waveform
//  3.25-6.25  Lab bench            Air alone moves the vocal folds      Flow
//  6.25-7.5   Nest                 Kittens nursing                      none
//  7.5-8.75   Vet's table          A frightened cat also purrs          none
//  8.75-10    Lightbox             Does purring heal bones?             none
//  10-12      Kitchen              A cat, its owner, an empty bowl      none
//  12-14.5    Spectrogram wall     The cry above the rumble             Spectrogram sketch
//  14.5-17    Listening test       The cry is erased, urgency falls     Comparison
//  17-18      Lap                  The cat looks back at you            none
import * as THREE from "three";
import { makeCameraRig, type CameraFn, type CameraKey, type V3 } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import type { DiagramSpec } from "../../src/core/diagrams/spec";
import { hash } from "../../src/core/math";
import { hitPulse, shake } from "../../src/core/motion";
import { resolveCaptions, resolveTime } from "../../src/core/spec";
import { meta, spec } from "./meta";
import {
  barT,
  CRY_HIGH_HZ,
  CRY_LOW_HZ,
  CRY_STUDY_YEAR,
  hzRange,
  LARYNX_COUNT,
  LARYNX_HIGH_HZ,
  LARYNX_LOW_HZ,
  LARYNX_STUDY_YEAR,
  PURR_LOW_HZ,
  PURR_PERIOD_MS,
  purrPressure,
  spectroHeight,
} from "./physics";
import { SONG_MAP } from "./songMap";

const seconds = (frames: number[]) => frames.map((f) => f / SONG_MAP.fps);

export const KICKS = seconds(SONG_MAP.kickFrames);
export const STABS = seconds(SONG_MAP.stabFrames);
export const IMPACTS = seconds(SONG_MAP.impactFrames ?? []);

const LARYNX_RANGE = hzRange(LARYNX_LOW_HZ, LARYNX_HIGH_HZ);
const CRY_RANGE = hzRange(CRY_LOW_HZ, CRY_HIGH_HZ);

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  purrLowEnd: PURR_LOW_HZ,
  larynxCount: LARYNX_COUNT,
  larynxFrequency: LARYNX_RANGE,
  cryFrequencyRange: CRY_RANGE,
});

/** Where each set stands in the world, far enough apart that no camera sees another set. */
export const SETS = { portrait: 0, wave: 150, lab: 300, nursery: 450, vet: 600, xray: 750, kitchen: 900, spectrum: 1050, listener: 1200, lap: 1350 };

const CUT = 1 / spec.format.fps;
/** Share of the camera distance to aim below a subject, which lifts it into the top half of the frame, above the captions. */
const LIFT = 0.13;

const hold = (from: number, to: number, pos0: V3, pos1: V3, subject: V3): CameraKey[] => {
  const aim = (pos: V3): V3 => [subject[0], subject[1] - LIFT * Math.hypot(pos[0] - subject[0], pos[1] - subject[1], pos[2] - subject[2]), subject[2]];
  return [
    { t: from, pos: pos0, target: aim(pos0), fov: 40 },
    { t: to - CUT, pos: pos1, target: aim(pos1), fov: 40 },
  ];
};

const { portrait, wave, lab, nursery, vet, xray, kitchen, spectrum, listener, lap } = SETS;
const rig = makeCameraRig([
  ...hold(0, barT(2), [portrait, 13, 92], [portrait, 13, 85], [portrait, 12.8, 0]),
  ...hold(barT(2), barT(3.25), [wave - 2, 6, 97], [wave - 2, 6, 91], [wave - 2, 4.9, 0]),
  ...hold(barT(3.25), barT(5), [lab - 1, 7, 98], [lab - 1, 7, 92], [lab - 1, 4.6, 0]),
  ...hold(barT(5), barT(6.25), [lab, 6.5, 58], [lab, 6.5, 52], [lab, 5.4, 0]),
  ...hold(barT(6.25), barT(7.5), [nursery - 0.5, 9, 68], [nursery - 0.5, 9, 63], [nursery - 0.5, 3, 1]),
  ...hold(barT(7.5), barT(8.75), [vet + 1, 11, 48], [vet + 1, 11, 43], [vet, 8.6, 1]),
  ...hold(barT(8.75), barT(10), [xray, 7, 92], [xray, 7, 86], [xray, 6.8, 0]),
  ...hold(barT(10), barT(11), [kitchen - 1.2, 8, 84], [kitchen - 1.2, 8, 80], [kitchen - 1.2, 5.85, 0]),
  ...hold(barT(11), barT(12), [kitchen + 3.5, 5, 47], [kitchen + 3.5, 5, 43], [kitchen + 3.5, 3.5, 1]),
  ...hold(barT(12), barT(13), [spectrum, 7, 100], [spectrum, 7, 96], [spectrum, 6.2, 0]),
  ...hold(barT(13), barT(14.5), [spectrum, 7, 75], [spectrum, 7, 70], [spectrum, 6.2, 0]),
  ...hold(barT(14.5), barT(16), [listener, 6.5, 90], [listener, 6.5, 85], [listener, 4.8, -1]),
  ...hold(barT(16), barT(17), [listener + 1, 6, 74], [listener + 1, 6, 70], [listener + 1, 4.8, -1]),
  ...hold(barT(17), barT(18) + 0.2, [lap, 13, 76], [lap, 13, 69], [lap, 11.4, 1.5]),
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

/** A section title for each shot from the third bar on, short enough to stay in the safe zone. The last shot is left clear for the closing line. */
export const TITLES: { from: number; to: number; text: string }[] = [
  { from: barT(2), to: barT(3.25), text: "THE LOW RUMBLE" },
  { from: barT(3.25), to: barT(6.25), text: `${LARYNX_STUDY_YEAR} LAB TEST` },
  { from: barT(6.25), to: barT(7.5), text: "BONDING?" },
  { from: barT(7.5), to: barT(8.75), text: "COMFORT?" },
  { from: barT(8.75), to: barT(10), text: "X-RAY SKETCH" },
  { from: barT(10), to: barT(12), text: "DINNER TIME" },
  { from: barT(12), to: barT(14.5), text: `${CRY_STUDY_YEAR} STUDY` },
  { from: barT(14.5), to: barT(17), text: "LISTENING TEST" },
];

const WAVE_CYCLES = 3;
const WAVE_POINTS = 60;

export const SPECTRO_ROWS = 12;
export const SPECTRO_COLS = 36;
const CRY_FROM_COL = 4;
const CRY_TO_COL = 31;

/** Whether a frequency band reaches into a row of the spectrogram. Row 0 is the top. */
const bandInRow = (row: number, lowHz: number, highHz: number) => spectroHeight(highHz) > 1 - (row + 1) / SPECTRO_ROWS && spectroHeight(lowHz) < 1 - row / SPECTRO_ROWS;

const spectroCell = (col: number, row: number) => {
  if (bandInRow(row, CRY_LOW_HZ, CRY_HIGH_HZ) && col >= CRY_FROM_COL && col <= CRY_TO_COL && hash(col, row + 80) > 0.22) return "C";
  if (bandInRow(row, LARYNX_LOW_HZ, LARYNX_HIGH_HZ) && col % 3 !== 2) return "P";
  return ".";
};

/** A sketch of the spectrogram, placed from the real frequencies. The diagram and the 3D wall both draw it. */
export const SPECTROGRAM = Array.from({ length: SPECTRO_ROWS }, (_, row) => Array.from({ length: SPECTRO_COLS }, (_, col) => spectroCell(col, row)).join(""));

const rowOfHz = (hz: number) => Math.floor((1 - spectroHeight(hz)) * SPECTRO_ROWS);

/** Keyed by the diagram names in the spec's shot list. */
export const DIAGRAMS: Record<string, DiagramSpec> = {
  "Low-pitched purr waveform": {
    type: "line",
    title: `${PURR_LOW_HZ} HZ WAVE, SHAPE ILLUSTRATIVE`,
    xLabel: "MILLISECONDS",
    series: [
      {
        label: "PURR",
        points: Array.from({ length: WAVE_POINTS + 1 }, (_, i): [number, number] => {
          const ms = (i / WAVE_POINTS) * WAVE_CYCLES * PURR_PERIOD_MS;
          return [ms, purrPressure(ms)];
        }),
      },
    ],
  },
  "Airflow making the vocal folds oscillate": {
    type: "flow",
    title: "AIR ALONE (ILLUSTRATED MODEL)",
    // Three steps, each short enough to sit on one line of its box.
    steps: ["WARM AIR", "VOCAL FOLDS", `${LARYNX_RANGE} HZ`],
  },
  "Sound spectrogram of a food-soliciting purr": {
    type: "map",
    title: "SKETCH: CRY ABOVE THE PURR (HZ)",
    rows: SPECTROGRAM,
    markers: [
      { col: 9, row: rowOfHz(Math.sqrt(CRY_LOW_HZ * CRY_HIGH_HZ)), label: `CRY ${CRY_RANGE}` },
      { col: 24, row: rowOfHz(LARYNX_HIGH_HZ), label: "LOW PURR" },
    ],
  },
  "Urgency rating with and without the cry": {
    type: "comparison",
    title: "URGENCY, CRY VS NO CRY (ILLUSTRATIVE)",
    left: "WITH CRY",
    right: "CRY REMOVED",
    rows: [
      { label: "CRY BAND", left: "IN THE PURR", right: "ERASED" },
      { label: "URGENCY", left: "HIGHER", right: "LOWER" },
    ],
  },
};

/** Which diagram is showing, from the shot list in the spec. */
export const SHOT_WINDOWS = spec.shots.map((shot) => ({ from: resolveTime(spec, shot.from), to: resolveTime(spec, shot.to), diagram: shot.diagram }));

/** Late and short, so that the last shot stays clear until its final few frames. */
export const END_FADE_FROM = meta.durationS - 0.2;
